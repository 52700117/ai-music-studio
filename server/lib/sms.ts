/**
 * Spug 推送短信服务封装
 *
 * 需要环境变量：
 *   SPUG_SMS_TEMPLATE_ID - Spug 推送平台的短信模板 ID
 *
 * 获取方式：
 *   1. 打开 https://push.spug.cc 微信扫码登录
 *   2. 创建「消息模板」→ 选择推送通道为「短信」→ 保存
 *   3. 复制模板 ID，填入 Railway 环境变量 SPUG_SMS_TEMPLATE_ID
 *
 * 如果环境变量未配置，sendSmsCode 返回 false（降级到开发模式，验证码固定 123456）
 */

export function isSmsEnabled(): boolean {
  return !!process.env.SPUG_SMS_TEMPLATE_ID
}

/**
 * 发送短信验证码
 * @param phone 手机号（11位，不带 +86）
 * @param code 6位验证码
 * @returns true=发送成功, false=发送失败
 */
export async function sendSmsCode(phone: string, code: string): Promise<boolean> {
  const templateId = process.env.SPUG_SMS_TEMPLATE_ID

  if (!templateId) {
    console.warn('[sms] Spug 短信未配置，跳过发送（开发模式）')
    return false
  }

  try {
    // Spug 推送 API：GET https://push.spug.cc/send/{template_id}
    // 参数：code=验证码内容, targets=接收手机号
    const url = `https://push.spug.cc/send/${templateId}?code=${encodeURIComponent(code)}&targets=${encodeURIComponent(phone)}`
    const resp = await fetch(url)
    const data = await resp.json() as { code?: number; msg?: string; message?: string }

    // Spug: code=0 或 resp.ok 表示成功
    if (resp.ok && data.code !== 1) {
      console.log(`[sms] 验证码已发送至 ${phone.slice(0, 3)}****${phone.slice(-4)}`)
      return true
    } else {
      console.error('[sms] 发送失败:', data.msg || data.message || 'unknown error')
      return false
    }
  } catch (e: any) {
    console.error('[sms] 发送异常:', e.message)
    return false
  }
}
