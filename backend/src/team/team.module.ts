import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Team, TeamSchema } from './schemas';
import { TeamMember, TeamMemberSchema } from 'src/team-member/schemas';
import { TeamInvite, TeamInviteSchema } from 'src/team-invite/schemas';
import { TeamActivity, TeamActivitySchema } from 'src/team-activity/schemas';
import { TeamsService } from './team.service';
import { TeamsController } from './team.controller';
import { User, UserSchema } from 'src/users/schemas';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Team.name, schema: TeamSchema },
      { name: TeamMember.name, schema: TeamMemberSchema },
      { name: TeamInvite.name, schema: TeamInviteSchema },
      { name: TeamActivity.name, schema: TeamActivitySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [TeamsService],
  controllers: [TeamsController],
  exports: [TeamsService],
})
export class TeamsModule {}