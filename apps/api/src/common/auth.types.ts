export type JwtRole = 'owner' | 'admin' | 'master' | 'superadmin';

export interface JwtPayload {
  sub: string; // user id (or employee id for master PIN tokens)
  role: JwtRole;
  company_id: string;
  employee_id?: string;
  name?: string;
}

export interface AuthedRequest extends Express.Request {
  user: JwtPayload;
}
