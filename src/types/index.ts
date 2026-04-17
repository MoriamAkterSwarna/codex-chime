export type EvaluationStatus = "pending" | "running" | "completed" | "failed";

export interface Project {
  id: string;
  student_name: string;
  project_title: string;
  live_url: string;
  github_repo: string;
  created_at: string;
}

export interface AiFeedback {
  uiUxIssues: string[];
  layoutIssues: string[];
  responsivenessIssues: string[];
  suggestions: string[];
  strengths: string[];
  overallSummary: string;
}

export interface GithubAnalysis {
  repoName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  hasReadme: boolean;
  fileCount: number;
  folderStructure: { name: string; type: string }[];
  lastCommit: string | null;
}

export interface Evaluation {
  id: string;
  project_id: string;
  status: EvaluationStatus;
  desktop_screenshot_url: string | null;
  mobile_screenshot_url: string | null;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  ui_design_score: number | null;
  functionality_score: number | null;
  responsiveness_score: number | null;
  code_quality_score: number | null;
  total_score: number | null;
  ai_feedback: AiFeedback | null;
  github_analysis: GithubAnalysis | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithEvaluation extends Project {
  evaluation: Evaluation | null;
}
