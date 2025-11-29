import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TeamRole } from 'src/team/schemas';

export type TeamMemberDocument = TeamMember & Document;

@Schema({ timestamps: true })
export class TeamMember {
  @Prop({ type: Types.ObjectId, ref: 'Team', required: true })
  teamId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ 
    type: String, 
    enum: TeamRole, 
    default: TeamRole.MEMBER 
  })
  role: TeamRole;

  @Prop({ default: Date.now })
  joinedAt: Date;
}

export const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);

// Compound index to ensure unique user per team
TeamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });