import { PartialType } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsMongoId, IsEnum } from 'class-validator';
import { TeamRole } from '../schemas';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;
}
export class UpdateTeamDto extends PartialType(CreateTeamDto) {}
export class ChangeRoleDto {
    @IsMongoId()
    userId: string;
  
    @IsEnum(TeamRole)
    newRole: TeamRole;
  }