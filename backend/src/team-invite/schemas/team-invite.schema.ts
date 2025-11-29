import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TeamInviteDocument = TeamInvite & Document;

@Schema({ timestamps: true })
export class TeamInvite {
  @Prop({ type: Types.ObjectId, ref: 'Team', required: true })
  teamId: Types.ObjectId;

  @Prop({ required: true })
  email: string;

  @Prop({ type: String, enum: ['OWNER', 'ADMIN', 'MEMBER'], default: 'MEMBER' })
  role: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy: Types.ObjectId;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 'pending' })
  status: string; // pending, accepted, expired

  @Prop()
  token: string; // For invite link
}

export const TeamInviteSchema = SchemaFactory.createForClass(TeamInvite);