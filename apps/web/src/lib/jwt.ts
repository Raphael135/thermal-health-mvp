export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'TECHNICIAN';
  patientProfileId?: string;
  doctorProfileId?: string;
  exp: number;
}

export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
