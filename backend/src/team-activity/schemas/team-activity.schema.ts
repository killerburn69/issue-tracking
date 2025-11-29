import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TeamActivityDocument = TeamActivity & Document;

export enum ActivityType {
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_LEFT = 'MEMBER_LEFT',
  MEMBER_KICKED = 'MEMBER_KICKED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  TEAM_CREATED = 'TEAM_CREATED',
  TEAM_UPDATED = 'TEAM_UPDATED',
  PROJECT_CREATED = 'PROJECT_CREATED',
  PROJECT_DELETED = 'PROJECT_DELETED',
}

@Schema({ timestamps: true })
export class TeamActivity {
  @Prop({ type: Types.ObjectId, ref: 'Team', required: true })
  teamId: Types.ObjectId;

  @Prop({ type: String, enum: ActivityType, required: true })
  type: ActivityType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy: Types.ObjectId;

  @Prop({ type: Object })
  metadata: any; // Flexible field for additional data

  @Prop()
  description: string;
}

export const TeamActivitySchema = SchemaFactory.createForClass(TeamActivity);