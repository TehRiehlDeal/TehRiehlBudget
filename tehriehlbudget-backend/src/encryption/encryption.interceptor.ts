import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EncryptionService } from './encryption.service';

@Injectable()
export class EncryptionInterceptor implements NestInterceptor {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly fields: string[],
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Encrypt fields in request body
    const request = context.switchToHttp().getRequest();
    if (request.body) {
      for (const field of this.fields) {
        if (field in request.body) {
          request.body[field] = this.encryptionService.encryptField(
            request.body[field],
          );
        }
      }
    }

    // Decrypt fields in response
    return next.handle().pipe(
      map((data) => {
        if (Array.isArray(data)) {
          return data.map((item) => this.decryptObject(item));
        }
        if (data && typeof data === 'object') {
          // Handle paginated responses
          if ('data' in data && Array.isArray(data.data)) {
            return {
              ...data,
              data: data.data.map((item: any) => this.decryptObject(item)),
            };
          }
          return this.decryptObject(data);
        }
        return data;
      }),
    );
  }

  private decryptObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const result = { ...obj };
    for (const field of this.fields) {
      if (field in result) {
        result[field] = this.encryptionService.decryptField(result[field]);
      }
    }
    return result;
  }
}
