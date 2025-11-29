import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { MailerService } from '@nestjs-modules/mailer';
import { User, UserDocument } from 'src/users/schemas';
import { PasswordResetToken } from 'src/password-reset-token/schemas';
import { LoginDto, ResetPasswordDto, SignUpDto } from './dtos';


@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PasswordResetToken.name) private resetTokenModel: Model<PasswordResetToken>,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<{ user: User; token: string }> {
    const { email, password, name } = signUpDto;

    // Check email duplication
    const existingUser = await this.userModel.findOne({ 
      email, 
      isDeleted: false 
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.userModel.create({
      email,
      password: hashedPassword,
      name,
      isOAuth: false,
    });

    const token = this.jwtService.sign({ id: user._id });

    return { user, token };
  }

  async login(loginDto: LoginDto): Promise<{ user: User; token: string }> {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ 
      email, 
      isDeleted: false,
      isOAuth: false 
    });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.jwtService.sign({ id: user._id });

    return { user, token };
  }

  async googleLogin(profile: any): Promise<{ user: User; token: string }> {
    const { email, name, picture, sub } = profile;

    let user = await this.userModel.findOne({ 
      email, 
      isDeleted: false 
    });

    if (!user) {
      user = await this.userModel.create({
        email,
        name,
        profileImage: picture,
        isOAuth: true,
        oauthProvider: 'google',
        oauthId: sub,
      });
    } else if (!user.isOAuth) {
      // Regular user exists with same email - treat as separate account
      throw new ConflictException('Email already exists with regular account');
    }

    const token = this.jwtService.sign({ id: user._id });

    return { user, token };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userModel.findOne({ 
      email, 
      isDeleted: false,
      isOAuth: false 
    });
    
    if (!user) {
      // Don't reveal whether email exists
      return;
    }

    // Generate reset token
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.resetTokenModel.create({
      email,
      token,
      expiresAt,
    });

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    await this.mailerService.sendMail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
      `,
    });
  }

  async resetPassword(token: string, resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { newPassword, confirmPassword } = resetPasswordDto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const resetToken = await this.resetTokenModel.findOne({
      token,
      expiresAt: { $gt: new Date() },
      isUsed: false,
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.userModel.findOne({ 
      email: resetToken.email,
      isDeleted: false 
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Mark token as used
    resetToken.isUsed = true;
    await resetToken.save();
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    
    if (!user || user.isOAuth || !user.password) {
      throw new BadRequestException('Password change not allowed for OAuth users');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
  }

  async updateProfile(userId: string, name: string, profileImage?: string): Promise<User> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { name, ...(profileImage && { profileImage }) },
      { new: true }
    );
  }

  async deleteAccount(userId: string, password?: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if user has owned teams (to be implemented later)
    // For now, we'll assume no teams exist

    if (!user.isOAuth) {
      if (!password) {
        throw new BadRequestException('Password required for regular users');
      }
      
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new BadRequestException('Password is incorrect');
      }
    }

    // Soft delete
    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();
  }

  async validateGoogleUser(googleUser: {
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
    googleId: string;
  }): Promise<{ user: User; isNew: boolean }> {
    const { email, firstName, lastName, picture, googleId } = googleUser;

    // Check if user exists with this Google ID
    let user = await this.userModel.findOne({ oauthId: googleId, oauthProvider: 'google' });

    if (user) {
      return { user, isNew: false };
    }

    // Check if user exists with this email (but different auth method)
    user = await this.userModel.findOne({ email, isDeleted: false });

    if (user) {
      if (!user.isOAuth) {
        throw new ConflictException('Email already exists with regular account');
      }
      // Update existing OAuth user with Google info
      user.oauthId = googleId;
      user.oauthProvider = 'google';
      user.profileImage = picture;
      await user.save();
      return { user, isNew: false };
    }

    // Create new user
    const newUser = await this.userModel.create({
      email,
      name: `${firstName} ${lastName}`.trim(),
      profileImage: picture,
      isOAuth: true,
      oauthProvider: 'google',
      oauthId: googleId,
    });

    return { user: newUser, isNew: true };
  }
}