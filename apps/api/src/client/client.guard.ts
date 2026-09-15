import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface ClientPrincipal {
  clientId: string;
  companyId: string;
}

@Injectable()
export class ClientGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync(header.slice(7), {
        secret: process.env.JWT_SECRET ?? 'dev-secret',
      });
      if (payload.type !== 'client') throw new UnauthorizedException();
      req.client = { clientId: payload.sub, companyId: payload.company_id } as ClientPrincipal;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}

export const CurrentClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientPrincipal =>
    ctx.switchToHttp().getRequest().client,
);
