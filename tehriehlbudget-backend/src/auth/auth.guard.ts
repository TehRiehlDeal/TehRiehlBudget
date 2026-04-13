import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private supabaseService: SupabaseService,
    private prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    const supabaseUser = await this.supabaseService.validateToken(token);

    if (!supabaseUser) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Upsert user in local database (creates on first login)
    const user = await this.prismaService.user.upsert({
      where: { supabaseId: supabaseUser.id },
      update: { email: supabaseUser.email! },
      create: {
        supabaseId: supabaseUser.id,
        email: supabaseUser.email!,
      },
    });

    request.user = user;
    return true;
  }
}
