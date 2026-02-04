
import { GoogleGenAI } from "@google/genai";
import { AspectRatio, ImageSize, InspirationItem } from "./types";

export class GeminiService {
  /**
   * 每次请求前动态创建客户端实例，确保使用最新的 API Key。
   */
  private static getClient() {
    return new GoogleGenAI({ 
      apiKey: process.env.API_KEY
    });
  }

  /**
   * 指数退避重试包装函数
   */
  private static async withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const isQuotaError = error.message?.includes("429") || 
                           error.message?.includes("RESOURCE_EXHAUSTED") ||
                           error.status === 429;
      
      if (isQuotaError && retries > 0) {
        console.warn(`检测到频率限制 (429)，正在进行第 ${4 - retries} 次重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  /**
   * 高清放大图片 (4K)
   */
  static async upscaleImage(base64Image: string): Promise<string> {
    return this.withRetry(async () => {
      const ai = this.getClient();
      const model = 'gemini-3-pro-image-preview'; // nano banana pro
      
      const mimeType = base64Image.match(/data:(.*?);base64/)?.[1] || 'image/png';
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

      try {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              { inlineData: { data: cleanBase64, mimeType } },
              { text: "Please enhance this image to 4K resolution. Increase the clarity, sharpness, and detail while maintaining the original artistic style and removing any compression artifacts or noise." }
            ]
          },
          config: {
            imageConfig: {
              imageSize: '4K' as ImageSize
            }
          }
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
            }
          }
        }
        throw new Error("PRO_KEY_REQUIRED"); // Likely key not found or billing not active if no image
      } catch (error: any) {
        if (error.message?.includes("Requested entity was not found") || error.status === 404) {
          throw new Error("PRO_KEY_REQUIRED");
        }
        throw error;
      }
    });
  }

  /**
   * 生成图片
   */
  static async generateImage(
    prompt: string, 
    aspectRatio: AspectRatio = '1:1', 
    isPro: boolean = false,
    referenceImage: string | null = null
  ): Promise<string> {
    return this.withRetry(async () => {
      const ai = this.getClient();
      const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      const parts: any[] = [{ text: prompt }];
      
      if (referenceImage) {
        const mimeType = referenceImage.match(/data:(.*?);base64/)?.[1] || 'image/png';
        const cleanBase64 = referenceImage.replace(/^data:image\/\w+;base64,/, "");
        parts.unshift({
          inlineData: {
            data: cleanBase64,
            mimeType
          }
        });
      }

      try {
        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction: "You are a professional image generation assistant. Always output the result as an image part. Do not reply with text unless absolutely necessary for safety refusals.",
            imageConfig: {
              aspectRatio: aspectRatio,
              ...(isPro ? { imageSize: '1K' as ImageSize } : {})
            }
          }
        });

        if (response.candidates?.[0]?.content?.parts) {
          let textResponse = "";
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
            }
            if (part.text) {
              textResponse += part.text;
            }
          }
          if (textResponse) {
            throw new Error(`模型返回了文字而非图片: ${textResponse}`);
          }
        }
        throw new Error("响应中未找到图片数据");
      } catch (error: any) {
        if (error.message?.includes("Requested entity was not found") || error.status === 404) {
          throw new Error("PRO_KEY_REQUIRED");
        }
        if (error.message?.includes("429") || error.status === 429) {
          throw new Error("API 配额已耗尽，请稍后再试或切换付费 Key。");
        }
        throw error;
      }
    });
  }

  /**
   * 处理图片（编辑/二次生成）
   */
  static async processImage(
    base64Image: string | null,
    prompt: string,
    aspectRatio: AspectRatio = '1:1'
  ): Promise<string> {
    return this.withRetry(async () => {
      const ai = this.getClient();
      const model = 'gemini-2.5-flash-image';
      
      const parts: any[] = [{ text: prompt }];
      
      if (base64Image) {
        const mimeType = base64Image.match(/data:(.*?);base64/)?.[1] || 'image/png';
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
        parts.unshift({ inlineData: { data: cleanBase64, mimeType } });
      }

      try {
        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction: "You are an expert image editor. Your task is to modify the provided image based on user instructions and return the modified image. Ensure the output is a high-quality image part.",
            imageConfig: {
              aspectRatio: aspectRatio
            }
          }
        });

        if (response.candidates?.[0]?.content?.parts) {
          let textResponse = "";
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
            }
            if (part.text) {
              textResponse += part.text;
            }
          }
          if (textResponse) {
            throw new Error(`渲染失败，AI 反馈: ${textResponse}`);
          }
        }
        throw new Error("处理失败，未返回图片");
      } catch (error: any) {
        if (error.message?.includes("429") || error.status === 429) {
          throw new Error("API 配额已耗尽 (429)，请稍等片刻再试。");
        }
        throw error;
      }
    });
  }

  /**
   * 图像类型 analysis
   */
  static async analyzeImageType(base64Image: string): Promise<'PHOTO' | 'PATTERN' | 'SCENE'> {
    return this.withRetry(async () => {
      const ai = this.getClient();
      const mimeType = base64Image.match(/data:(.*?);base64/)?.[1] || 'image/png';
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType } },
            { text: "分析此图片。它是：1) 物理地毯照片？2) 数字图案？3) 带有地毯的场景？仅回复 'PHOTO', 'PATTERN', 或 'SCENE'。" }
          ]
        }
      });

      const result = response.text?.trim().toUpperCase();
      if (result?.includes('SCENE')) return 'SCENE';
      if (result?.includes('PATTERN')) return 'PATTERN';
      return 'PHOTO';
    });
  }

  /**
   * 获取灵感 (使用 Google Search Grounding 获取 Pinterest 趋势)
   */
  static async getInspiration(keyword: string): Promise<InspirationItem[]> {
    return this.withRetry(async () => {
      const ai = this.getClient();
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `查找关于 "${keyword}" 的 Pinterest 灵感、设计趋势 and 视觉参考资料。请提供相关的文章或图片链接。`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const items: InspirationItem[] = chunks
          .filter((chunk: any) => chunk.web)
          .map((chunk: any) => ({
            title: chunk.web.title || "美学灵感参考",
            uri: chunk.web.uri,
          }));

        return items;
      } catch (error) {
        throw error;
      }
    });
  }
}
