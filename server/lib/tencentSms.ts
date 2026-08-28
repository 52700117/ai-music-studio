/**
 * 腾讯云短信服务封装
 *
 * 需要环境变量：
 *   TENCENT_SMS_SECRET_ID     - 腾讯云 API SecretId
 *   TENCENT_SMS_SECRET_KEY    - 腾讯云 API SecretKey
 *   TENCENT_SMS_APP_ID        - 短信应用 SDKAppID
 *   TENCENT_SMS_SIGN_NAME     - 短信签名内容（如"音乐制作工具"）
 *   TENCENT_SMS_TEMPLATE_ID   - 短信模板 ID（模板参数为 {1}：验证码）
 *
 * 如果环境变量未配置，sendSmsCode 返回 false（降级到开发模式）
 */
import { SmsClient } from 'tencentcloud-sdk-nodejs-sms'

let client: any = null

function getSmsClient(): any {
  if (client) return client

  const secretId = process.env.TENCENT_SMS_SECRET_ID
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY

  if (!secretId || !secretKey) return null

  const SmsClientClass = new SmsClient({
    credential: { secretId, secretKey },
    region: 'ap-guangzhou',
    profile: {
      httpProfile: { endpoint: 'sms.tencentcloudapi.com' },
    },
  })
  client = SmsClientClass
  return client
}

/**
 * 是否已启用腾讯云短信（环境变量是否配置）
 */
export function isSmsEnabled(): boolean {
  return !!(process.env.TENCENT_SMS_SECRET_ID && process.env.TENCENT_SMS_SECRET_KEY)
}

/**
 * 发送短信验证码
 * @param phone 手机号（11位，不带 +86）
 * @param code 6位验证码
 * @returns true=发送成功, false=发送失败
 */
export async function sendSmsCode(phone: string, code: string): Promise<boolean> {
  const smsClient = getSmsClient()
  if (!smsClient) {
    console.warn('[sms] 腾讯云短信未配置，跳过发送（开发模式）')
    return false
  }

  const appId = process.env.TENCENT_SMS_APP_ID
  const signName = process.env.TENCENT_SMS_SIGN_NAME
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID

  if (!appId || !signName || !templateId) {
    console.error('[sms] 缺少 AppId / SignName / TemplateId 环境变量')
    return false
  }

  try {
    const params = {
      SmsSdkAppId: appId,
      SignName: signName,
      TemplateId: templateId,
      TemplateParamSet: [code],
      PhoneNumberSet: [`+86${phone}`],
    }
    const resp = await smsClient.SendSms(params)
    const sendStatus = resp?.SendStatusSet?.[0]?.Code
    if (sendStatus === 'Ok') {
      console.log(`[sms] 验证码已发送至 ${phone.slice(0, 3)}****${phone.slice(-4)}`)
      return true
    } else {
      console.error('[sms] 发送失败:', resp?.SendStatusSet?.[0]?.Message || 'unknown')
      return false
    }
  } catch (e: any) {
    console.error('[sms] 发送异常:', e.message)
    return false
  }
}
