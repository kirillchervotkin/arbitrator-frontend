export type Id = string;
export type Format = "ROUND_ROBIN" | "SINGLE_ELIM" | "DOUBLE_ELIM";
export type StageType = "STAGE" | "GROUP" | "ROUND" | "PLAYOFF";
export interface Entity {
  id: Id;
  createdAt: string;
  updatedAt: string;
}
export interface Tournament extends Entity {
  name: string;
  season: string;
  type: "LEAGUE" | "CUP" | "SUPER_CUP";
  startDate: string;
  endDate: string;
  templateId: Id | null;
}
export interface Source {
  sourceType: "GROUP" | "WINNER" | "LOSER";
  sourceStageId?: Id;
  sourceGroupName?: string;
  sourcePosition?: number;
  sourceMatchId?: Id;
}
export interface EntryRule extends Source {
  slotName: string;
  sourceStageKey?: string;
}
export interface Settings {
  rounds?: number;
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
  tieBreakers?: ("headToHead" | "goalDifference" | "goalsScored" | "wins")[];
  legsPerRound?: number;
  neutralVenue?: boolean;
  dropToLowerBracket?: boolean;
  grandFinalReset?: boolean;
  qualification?: EntryRule[];
  // Manual sporting decisions (e.g. penalties), keyed by the last match of a series.
  decisions?: Record<Id, Id>;
  generated?: {
    series: Record<Id, Id[]>;
    roundByMatch: Record<Id, number>;
    reset?: { finalId: Id; resetId: Id; upperSlotId: Id };
    generatedAt: string;
  };
}
export interface Stage extends Entity {
  tournamentId: Id;
  parentStageId: Id | null;
  type: StageType;
  format: Format;
  name: string;
  sortOrder: number;
  settings: Settings | null;
}
export interface TeamSlot extends Entity {
  tournamentId: Id;
  stageId: Id;
  groupName: string | null;
  slotName: string;
  teamId: Id | null;
  seed: number | null;
}
export interface Match extends Entity {
  tournamentId: Id;
  stageId: Id | null;
  matchDate: string;
  cityId: Id;
  homeSlotId: Id | null;
  awaySlotId: Id | null;
  homeTeamId: Id | null;
  awayTeamId: Id | null;
  homeScore: number | null;
  awayScore: number | null;
}
export interface BracketSlot extends Entity {
  matchId: Id;
  side: "HOME" | "AWAY";
  sourceType: "GROUP" | "WINNER" | "LOSER";
  sourceStageId: Id | null;
  sourceGroupName: string | null;
  sourcePosition: number | null;
  sourceMatchId: Id | null;
  resolvedTeamId: Id | null;
}
export interface TemplateStage {
  key: string;
  name: string;
  type: StageType;
  format: Format;
  settings?: Settings;
  slots?: { name: string; seed?: number; teamId?: Id }[];
  children?: TemplateStage[];
}
export interface TemplateSchema {
  name: string;
  type: Tournament["type"];
  cityId: Id;
  intervalDays?: number;
  stages: TemplateStage[];
}
export interface Template extends Entity {
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  schema: TemplateSchema;
}
export interface Tables {
  tournaments: Tournament;
  stages: Stage;
  tournament_team_slots: TeamSlot;
  matches: Match;
  bracket_slots: BracketSlot;
  tournament_templates: Template;
}
export type Table = keyof Tables;
export interface Standing {
  teamId: Id;
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  tied: boolean;
}
export interface StageNode extends Stage {
  children: StageNode[];
}
export interface Calendar {
  tournament: Tournament;
  stages: Stage[];
  slots: TeamSlot[];
  matches: Match[];
  bracketSlots: BracketSlot[];
}
export interface GenerateOptions {
  cityId: Id;
  firstMatchDate?: string;
  intervalDays?: number;
}
