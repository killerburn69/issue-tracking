import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Team, TeamDocument, TeamRole } from './schemas';
import { TeamMember, TeamMemberDocument } from 'src/team-member/schemas';
import { TeamInvite, TeamInviteDocument } from 'src/team-invite/schemas';
import {
  ActivityType,
  TeamActivity,
  TeamActivityDocument,
} from 'src/team-activity/schemas';
import { MailerService } from '@nestjs-modules/mailer';
import { ChangeRoleDto, CreateTeamDto, UpdateTeamDto } from './dtos';
import { InviteMemberDto } from 'src/team-invite/dtos';
import { User, UserDocument } from 'src/users/schemas';

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    @InjectModel(TeamMember.name)
    private teamMemberModel: Model<TeamMemberDocument>,
    @InjectModel(TeamInvite.name)
    private teamInviteModel: Model<TeamInviteDocument>,
    @InjectModel(TeamActivity.name)
    private teamActivityModel: Model<TeamActivityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mailerService: MailerService,
  ) {}

  // FR-010: Create Team
  async createTeam(createTeamDto: CreateTeamDto, userId: string) {
    const session = await this.teamModel.db.startSession();
    session.startTransaction();

    try {
      // Create team
      const team = await this.teamModel.create(
        [
          {
            name: createTeamDto.name,
            ownerId: new Types.ObjectId(userId),
          },
        ],
        { session },
      );

      // Add creator as owner
      await this.teamMemberModel.create(
        [
          {
            teamId: team[0]._id,
            userId: new Types.ObjectId(userId),
            role: TeamRole.OWNER,
          },
        ],
        { session },
      );

      // Log activity
      await this.teamActivityModel.create(
        [
          {
            teamId: team[0]._id,
            type: ActivityType.TEAM_CREATED,
            performedBy: new Types.ObjectId(userId),
            description: `Team "${createTeamDto.name}" was created`,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      return team[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // FR-011: Update Team
  async updateTeam(
    teamId: string,
    updateTeamDto: UpdateTeamDto,
    userId: string,
  ) {
    const team = await this.verifyTeamAccess(teamId, userId, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
    ]);

    const updatedTeam = await this.teamModel.findByIdAndUpdate(
      teamId,
      updateTeamDto,
      { new: true },
    );

    // Log activity
    await this.teamActivityModel.create({
      teamId: new Types.ObjectId(teamId),
      type: ActivityType.TEAM_UPDATED,
      performedBy: new Types.ObjectId(userId),
      description: `Team name updated to "${updateTeamDto.name}"`,
    });

    return updatedTeam;
  }

  // FR-012: Delete Team
  async deleteTeam(teamId: string, userId: string) {
    const team = await this.verifyTeamAccess(teamId, userId, [TeamRole.OWNER]);

    // Soft delete
    const deletedTeam = await this.teamModel.findByIdAndDelete(teamId);
    const deletedTeamMembers = await this.teamMemberModel.findOneAndDelete({
      teamId: new Types.ObjectId(teamId),
    });
    return deletedTeam;
  }

  // FR-013: Invite Member
  async inviteMember(
    teamId: string,
    inviteMemberDto: InviteMemberDto,
    userId: string,
  ) {
    const team = await this.verifyTeamAccess(teamId, userId, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
    ]);

    // Check if user with this email exists
    const existingUser = await this.userModel.findOne({
      email: inviteMemberDto.email,
      isDeleted: false,
    });

    if (existingUser) {
      // Check if user is already a member
      const existingMember = await this.teamMemberModel.findOne({
        teamId: new Types.ObjectId(teamId),
        userId: existingUser._id,
      });

      if (existingMember) {
        throw new ConflictException('User is already a team member');
      }
    }

    // Check for existing pending invite
    const existingInvite = await this.teamInviteModel.findOne({
      teamId: new Types.ObjectId(teamId),
      email: inviteMemberDto.email,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (existingInvite) {
      // Update existing invite instead of throwing error
      existingInvite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      existingInvite.role = inviteMemberDto.role;
      await existingInvite.save();

      console.log('📧 Updated existing invite for:', inviteMemberDto.email);
      return existingInvite;
    }

    // Create new invite (expires in 7 days)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token =
      Math.random().toString(36).substring(2) + Date.now().toString(36);

    const invite = await this.teamInviteModel.create({
      teamId: new Types.ObjectId(teamId),
      email: inviteMemberDto.email,
      role: inviteMemberDto.role,
      invitedBy: new Types.ObjectId(userId),
      expiresAt,
      token,
      status: 'pending',
    });

    console.log('📧 Attempting to send email to:', inviteMemberDto.email);
    console.log('📧 SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      from: process.env.SMTP_FROM,
    });

    // Send email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/teams/invite/accept?token=${token}`;

    try {
      const emailResponse = await this.mailerService.sendMail({
        to: inviteMemberDto.email,
        subject: `Invitation to join team "${team.name}"`,
        html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">You've been invited to join ${team.name}</h2>
                <p>You have been invited to join the team <strong>"${team.name}"</strong> with role: <strong>${inviteMemberDto.role}</strong>.</p>
                <p>Click the button below to accept the invitation:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a>
                </div>
                <p style="color: #6B7280; font-size: 14px;">This invitation will expire in 7 days.</p>
                <p style="color: #6B7280; font-size: 14px;">If you didn't request this invitation, you can safely ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
                <p style="color: #9CA3AF; font-size: 12px;">This is an automated message from Issue Tracker.</p>
              </div>
            `,
      });

      console.log('✅ Email sent successfully:', emailResponse.messageId);
      console.log('✅ Invite URL:', inviteUrl);
    } catch (emailError) {
      console.error('❌ Failed to send invitation email:', emailError);
      console.error('❌ Email error details:', {
        message: emailError.message,
        stack: emailError.stack,
      });

      // Don't throw error - the invite is still created
      // You might want to handle this differently in production
    }

    return invite;
  }

  // FR-014: View Members
  async getTeamMembers(teamId: string, userId: string) {
    await this.verifyTeamAccess(teamId, userId, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.MEMBER,
    ]);

    const members = await this.teamMemberModel
      .find({ teamId: new Types.ObjectId(teamId) })
      .populate('userId', 'name email profileImage')
      .sort({ role: 1, joinedAt: 1 });

    return members;
  }

  // FR-015: Kick Member
  async kickMember(teamId: string, targetUserId: string, userId: string) {
    const team = await this.verifyTeamAccess(teamId, userId, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
    ]);

    // Get kicker's role
    const kickerMember = await this.teamMemberModel.findOne({
      teamId: new Types.ObjectId(teamId),
      userId: new Types.ObjectId(userId),
    });

    // Get target member
    const targetMember = await this.teamMemberModel.findOne({
      teamId: new Types.ObjectId(teamId),
      userId: new Types.ObjectId(targetUserId),
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    // Permission checks
    if (targetMember.userId.toString() === userId) {
      throw new BadRequestException('You cannot kick yourself');
    }

    if (targetMember.role === TeamRole.OWNER) {
      throw new ForbiddenException('Cannot kick team owner');
    }

    if (
      kickerMember.role === TeamRole.ADMIN &&
      targetMember.role === TeamRole.ADMIN
    ) {
      throw new ForbiddenException('ADMIN cannot kick other ADMINs');
    }

    // Remove member
    await this.teamMemberModel.findByIdAndDelete(targetMember._id);

    // Log activity
    await this.teamActivityModel.create({
      teamId: new Types.ObjectId(teamId),
      type: ActivityType.MEMBER_KICKED,
      performedBy: new Types.ObjectId(userId),
      metadata: { targetUserId, targetUserRole: targetMember.role },
      description: `Member was removed from the team`,
    });

    return { message: 'Member removed successfully' };
  }

  // FR-016: Leave Team
  async leaveTeam(teamId: string, userId: string) {
    const member = await this.teamMemberModel.findOne({
      teamId: new Types.ObjectId(teamId),
      userId: new Types.ObjectId(userId),
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this team');
    }

    if (member.role === TeamRole.OWNER) {
      throw new ForbiddenException(
        'OWNER cannot leave team. Transfer ownership or delete team.',
      );
    }

    await this.teamMemberModel.findByIdAndDelete(member._id);

    // Log activity
    await this.teamActivityModel.create({
      teamId: new Types.ObjectId(teamId),
      type: ActivityType.MEMBER_LEFT,
      performedBy: new Types.ObjectId(userId),
      description: `Member left the team`,
    });

    return { message: 'Left team successfully' };
  }

  // FR-018: Change Role
  async changeRole(
    teamId: string,
    changeRoleDto: ChangeRoleDto,
    userId: string,
  ) {
    const team = await this.verifyTeamAccess(teamId, userId, [TeamRole.OWNER]);

    const targetMember = await this.teamMemberModel.findOne({
      teamId: new Types.ObjectId(teamId),
      userId: new Types.ObjectId(changeRoleDto.userId),
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    // Check if trying to change owner's role
    if (targetMember.role === TeamRole.OWNER) {
      throw new ForbiddenException('Cannot change OWNER role');
    }

    // If transferring ownership
    if (changeRoleDto.newRole === TeamRole.OWNER) {
      // Current owner becomes ADMIN
      await this.teamMemberModel.findOneAndUpdate(
        {
          teamId: new Types.ObjectId(teamId),
          userId: new Types.ObjectId(userId),
        },
        { role: TeamRole.ADMIN },
      );

      // Update team owner
      await this.teamModel.findByIdAndUpdate(teamId, {
        ownerId: new Types.ObjectId(changeRoleDto.userId),
      });
    }

    const oldRole = targetMember.role;
    targetMember.role = changeRoleDto.newRole;
    await targetMember.save();

    // Log activity
    await this.teamActivityModel.create({
      teamId: new Types.ObjectId(teamId),
      type: ActivityType.ROLE_CHANGED,
      performedBy: new Types.ObjectId(userId),
      metadata: {
        targetUserId: changeRoleDto.userId,
        oldRole,
        newRole: changeRoleDto.newRole,
      },
      description: `Member role changed from ${oldRole} to ${changeRoleDto.newRole}`,
    });

    return targetMember;
  }

  // FR-019: Team Activity Log
  async getTeamActivities(
    teamId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    await this.verifyTeamAccess(teamId, userId, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.MEMBER,
    ]);

    const skip = (page - 1) * limit;

    const activities = await this.teamActivityModel
      .find({ teamId: new Types.ObjectId(teamId) })
      .populate('performedBy', 'name email profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await this.teamActivityModel.countDocuments({
      teamId: new Types.ObjectId(teamId),
    });

    return {
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Helper: Verify user has access to team with required role
  async verifyTeamAccess(
    teamId: string,
    userId: string,
    allowedRoles: TeamRole[],
  ) {
    const team = await this.teamModel.findOne({
      _id: teamId,
      isDeleted: false,
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const member = await this.teamMemberModel.findOne({
      teamId: new Types.ObjectId(teamId),
      userId: new Types.ObjectId(userId),
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }

    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return team;
  }

  // Get user's teams
  async getUserTeams(userId: string) {
    const teamMembers: any = await this.teamMemberModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('teamId')
      .sort({ createdAt: -1 })
      .lean();
    const getDetailUser = await this.userModel.findById(userId).lean();

    return teamMembers.map((member) => ({
      ...member,
      userRole: member.role,
      user: getDetailUser.name,
    }));
  }

  // Accept invite
  async acceptInvite(token: string, userId: string) {
    console.log('🔑 Processing invite token:', token);

    const invite = await this.teamInviteModel
      .findOne({
        token,
        status: 'pending',
      })
      .lean();

    console.log('📧 Found invite:', invite);

    if (!invite) {
      throw new NotFoundException('Invalid or expired invitation');
    }

    // Get user details
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is already a member of this team
    const existingMember = await this.teamMemberModel.findOne({
      teamId: invite.teamId._id,
      userId: new Types.ObjectId(userId),
    });

    if (existingMember) {
      // User is already a member, update invite status and return
      invite.status = 'accepted';
      await this.teamInviteModel.updateOne(
        {
          token,
        },
        invite,
      );
      const teamId =
        invite?.teamId?._id ?? // case 1: populated
        invite?.teamId ?? // case 2: not populated
        null;

      if (!teamId) {
        throw new BadRequestException('Invite does not contain a valid teamId');
      }

      const result = await this.teamMemberModel.create({
        userId: new Types.ObjectId(userId),
        teamId: new Types.ObjectId(teamId),
        role: 'MEMBER',
        joinedAt: new Date(),
      });
      return {
        message: 'You are already a member of this team',
        team: invite.teamId,
        alreadyMember: true,
      };
    }

    // Check if user is an OWNER of any other teams
    const userOwnedTeams = await this.teamMemberModel
      .find({
        userId: new Types.ObjectId(userId),
        role: TeamRole.OWNER,
      })
      .populate('teamId');

    const session = await this.teamMemberModel.db.startSession();
    session.startTransaction();

    try {
      // Add user to team
      await this.teamMemberModel.create(
        [
          {
            teamId: invite.teamId._id,
            userId: new Types.ObjectId(userId),
            role: invite.role,
          },
        ],
        { session },
      );

      // Update invite status
      invite.status = 'accepted';
      await invite.save({ session });

      // Log activity
      let activityDescription = `${user.name} joined the team via invitation`;

      // Special message if user is an OWNER of other teams
      //   if (userOwnedTeams.length > 0) {
      //     const ownedTeamNames = userOwnedTeams.map(member => member.teamId.name).join(', ');
      //     activityDescription = `${user.name} (Owner of ${ownedTeamNames}) joined the team via invitation`;
      //   }

      await this.teamActivityModel.create(
        [
          {
            teamId: invite.teamId._id,
            type: ActivityType.MEMBER_JOINED,
            performedBy: new Types.ObjectId(userId),
            description: activityDescription,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      console.log('✅ Invite accepted successfully for user:', userId);

      return {
        message: 'Invitation accepted successfully',
        team: invite.teamId,
        alreadyMember: false,
        isOwnerOfOtherTeams: userOwnedTeams.length > 0,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error('❌ Error accepting invite:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}
