import { AsyncLocalStorage } from "node:async_hooks";
import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";

const messageContextStorage = new AsyncLocalStorage();
let client = null;

const SENSITIVE_PATTERN = /(?:\b(?:cccd|cmnd|so tai khoan|chuyen khoan|momo|ngan hang|so dien thoai|sdt)\b|\b\d{9,16}\b)/i;

function cleanText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function isEnabled() {
  return config.geminiEnabled === true && Boolean(config.geminiApiKey);
}

function getClient() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return client;
}

function currentMessageContext() {
  return messageContextStorage.getStore() || {};
}

/**
 * Bọc toàn bộ một lượt webhook Messenger. AsyncLocalStorage giữ đúng ngữ cảnh
 * riêng cho từng request, không bị lẫn khi nhiều khách nhắn cùng lúc.
 */
export function runWithGeminiMessageContext(context, handler) {
  return messageContextStorage.run({ ...(context || {}) }, handler);
}

function quickReplyTitles(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => cleanText(item?.title))
    .filter(Boolean)
    .slice(0, 13);
}

function normalizedNumberTokens(text = "") {
  return (String(text).match(/\d[\d.,:]*/g) || [])
    .map(value => value.replace(/\D/g, ""))
    .filter(value => value.length >= 2);
}

function preservesNumericFacts(original, rewritten) {
  const expected = normalizedNumberTokens(original);
  if (!expected.length) return true;
  const actualDigits = normalizedNumberTokens(rewritten).join("|");
  return expected.every(value => actualDigits.includes(value));
}

function shouldSkipRewrite(originalReply, store) {
  if (!isEnabled()) return true;
  if (!originalReply || originalReply.length < 24) return true;

  const maxPerMessage = Math.max(0, Number(config.geminiMaxRewritesPerMessage || 0));
  if (maxPerMessage === 0 || Number(store.rewriteCount || 0) >= maxPerMessage) return true;

  // Gemini Free Tier có thể dùng dữ liệu để cải thiện sản phẩm. Mặc định bỏ qua
  // các câu có SĐT/CCCD/tài khoản/chuyển khoản để không gửi dữ liệu nhạy cảm.
  if (!config.geminiRewriteSensitive && SENSITIVE_PATTERN.test(originalReply)) return true;

  return false;
}

function timeoutAfter(ms) {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("gemini_timeout");
      error.code = "GEMINI_TIMEOUT";
      reject(error);
    }, Math.max(500, Number(ms || 8_000)));
    timer.unref?.();
  });
}

/**
 * Gemini chỉ viết lại câu trả lời đã được logic cũ xác minh.
 * Không cho Gemini tự đọc Firebase, tự quyết định lịch hoặc tự tạo giá.
 */
export async function rewriteReplyWithGemini({
  originalReply,
  quickReplies = [],
  maxCharacters = 2000
} = {}) {
  const fallback = cleanText(originalReply).slice(0, maxCharacters);
  const store = currentMessageContext();

  if (shouldSkipRewrite(fallback, store)) return fallback;

  const titles = quickReplyTitles(quickReplies);
  const prompt = `
Bạn là trợ lý tư vấn của ${config.brandName}.

NHIỆM VỤ
Viết lại CÂU TRẢ LỜI GỐC thành tiếng Việt tự nhiên, thân thiện, mềm mại và ngắn gọn.

QUY TẮC BẮT BUỘC
- Chỉ dùng thông tin có trong CÂU TRẢ LỜI GỐC.
- Không tự tạo hoặc thay đổi HOME, giá, ngày, giờ, thời lượng, tiện ích, chính sách hay ưu đãi.
- Giữ nguyên mọi con số và dữ kiện quan trọng.
- Xưng hô “Home” và “Bạn”; không nói mình là AI hay Gemini.
- Không tự chuyển nhân viên nếu câu gốc không yêu cầu.
- Không thêm thông tin chuyển khoản, số điện thoại hoặc dữ liệu cá nhân.
- Tối đa 4 câu ngắn, tối đa 2 emoji.
- Nếu có nút gợi ý, câu trả lời phải phù hợp với các nút đó.
- Chỉ trả về nội dung cuối cùng, không giải thích.

TIN NHẮN KHÁCH
${cleanText(store.userMessage || "")}

PAYLOAD/NÚT KHÁCH BẤM
${cleanText(store.payload || "")}

CÁC NÚT SẼ HIỂN THỊ
${titles.length ? titles.join(" | ") : "Không có"}

CÂU TRẢ LỜI GỐC
${fallback}
`.trim();

  try {
    const request = getClient().models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: {
        temperature: Math.min(0.5, Math.max(0, Number(config.geminiTemperature || 0.2))),
        maxOutputTokens: Math.max(64, Number(config.geminiMaxOutputTokens || 220))
      }
    });

    const response = await Promise.race([
      request,
      timeoutAfter(config.geminiTimeoutMs)
    ]);

    const rewritten = cleanText(response?.text).slice(0, maxCharacters);
    if (!rewritten) return fallback;
    if (!preservesNumericFacts(fallback, rewritten)) {
      console.warn("Gemini rewrite rejected: numeric facts changed");
      return fallback;
    }

    store.rewriteCount = Number(store.rewriteCount || 0) + 1;
    return rewritten;
  } catch (error) {
    console.warn("Gemini rewrite fallback", {
      code: error?.code || "",
      status: error?.status || error?.response?.status || "",
      message: String(error?.message || error || "gemini_error").slice(0, 300)
    });
    return fallback;
  }
}
