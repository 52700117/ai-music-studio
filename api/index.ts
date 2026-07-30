/**
 * Vercel deploy entry handler, for serverless deployment, please don't modify this file
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // express 4.x 的 app 是可调用对象，但 @types/express 在某些版本下
  // Application 类型未声明 call signature，这里用 as any 绕过类型检查
  return (app as any)(req, res);
}