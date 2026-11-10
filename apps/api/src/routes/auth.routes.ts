import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.get('/test', authenticate, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Authenticated test route accessed successfully.',
      principal: req.user,
    },
  });
});
