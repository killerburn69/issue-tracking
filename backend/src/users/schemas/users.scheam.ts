import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, maxlength: 255 })
  email: string;

  @Prop({ required: false, maxlength: 100 }) // Optional for OAuth users
  password?: string;

  @Prop({ required: true, maxlength: 50 })
  name: string;

  @Prop()
  profileImage?: string;

  @Prop({ default: false })
  isOAuth: boolean;

  @Prop()
  oauthProvider?: string;

  @Prop()
  oauthId?: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);