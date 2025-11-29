import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
  } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TeamsService } from './team.service';
import { ChangeRoleDto, CreateTeamDto, UpdateTeamDto } from './dtos';
import { InviteMemberDto } from 'src/team-invite/dtos';
import { TeamRole } from './schemas';

  
  @Controller('teams')
  @UseGuards(JwtAuthGuard)
  export class TeamsController {
    constructor(private readonly teamsService: TeamsService) {}
  
    // FR-010: Create Team
    @Post()
    async createTeam(@Body() createTeamDto: CreateTeamDto, @Req() req) {
      return this.teamsService.createTeam(createTeamDto, req.user.id);
    }
  
    // Get user's teams
    @Get('my-teams')
    async getUserTeams(@Req() req) {
      return this.teamsService.getUserTeams(req.user.id);
    }
  
    // FR-011: Update Team
    @Put(':id')
    async updateTeam(
      @Param('id') id: string,
      @Body() updateTeamDto: UpdateTeamDto,
      @Req() req,
    ) {
      return this.teamsService.updateTeam(id, updateTeamDto, req.user.id);
    }
  
    // FR-012: Delete Team
    @Delete(':id')
    async deleteTeam(@Param('id') id: string, @Req() req) {
      return this.teamsService.deleteTeam(id, req.user.id);
    }
  
    // FR-013: Invite Member
    @Post(':id/invite')
    async inviteMember(
      @Param('id') id: string,
      @Body() inviteMemberDto: InviteMemberDto,
      @Req() req,
    ) {
      return this.teamsService.inviteMember(id, inviteMemberDto, req.user.id);
    }
  
    // FR-014: View Members
    @Get(':id/members')
    async getTeamMembers(@Param('id') id: string, @Req() req) {
      return this.teamsService.getTeamMembers(id, req.user.id);
    }
  
    // FR-015: Kick Member
    @Delete(':id/members/:userId')
    async kickMember(
      @Param('id') id: string,
      @Param('userId') userId: string,
      @Req() req,
    ) {
      return this.teamsService.kickMember(id, userId, req.user.id);
    }
  
    // FR-016: Leave Team
    @Post(':id/leave')
    async leaveTeam(@Param('id') id: string, @Req() req) {
      return this.teamsService.leaveTeam(id, req.user.id);
    }
  
    // FR-018: Change Role
    @Put(':id/role')
    async changeRole(
      @Param('id') id: string,
      @Body() changeRoleDto: ChangeRoleDto,
      @Req() req,
    ) {
      return this.teamsService.changeRole(id, changeRoleDto, req.user.id);
    }
  
    // FR-019: Team Activity Log
    @Get(':id/activities')
    async getTeamActivities(
      @Param('id') id: string,
      @Query('page') page: number = 1,
      @Query('limit') limit: number = 20,
      @Req() req,
    ) {
      return this.teamsService.getTeamActivities(id, req.user.id, page, limit);
    }
  
    // Accept invite
    @Post('invite/accept')
    async acceptInvite(@Query('token') token: string, @Req() req) {
      return this.teamsService.acceptInvite(token, req.user.id);
    }
  
    // Get team details
    @Get(':id')
    async getTeam(@Param('id') id: string, @Req() req) {
      // This would use verifyTeamAccess to check permissions
      // Use TeamRole enum values instead of string literals
      return this.teamsService.verifyTeamAccess(id, req.user.id, [
        TeamRole.OWNER,
        TeamRole.ADMIN,
        TeamRole.MEMBER,
      ]);
    }
}