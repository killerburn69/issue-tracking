import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { TeamRole } from 'src/team/schemas';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(TeamRole)
  @IsOptional()
  role?: TeamRole = TeamRole.MEMBER;
}