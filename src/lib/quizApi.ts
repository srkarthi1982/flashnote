type QuizQuestion = {
  questionId: string;
  questionText: string;
  answerText: string;
  explanation?: string | null;
  topicId?: string | null;
  subjectId?: string | null;
  platformId?: string | null;
  roadmapId?: string | null;
  difficulty?: string | null;
};

export type QuizQuestionsResponse = {
  items: QuizQuestion[];
};

export type QuizSourceSuggestion = {
  type: "roadmap" | "topic" | "subject" | "platform";
  id: string;
  label: string;
  contextLabel?: string | null;
};

export type QuizSourcesResponse = {
  roadmaps: QuizSourceSuggestion[];
  topics: QuizSourceSuggestion[];
  subjects: QuizSourceSuggestion[];
  platforms: QuizSourceSuggestion[];
};

export const fetchQuizQuestions = async (params: {
  token: string;
  quizId?: string;
  roadmapId?: string;
  topicId?: string;
  subjectId?: string;
  platformId?: string;
  limit?: number;
}): Promise<QuizQuestionsResponse> => {
  const baseUrl = import.meta.env.QUIZ_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("Quiz API base URL is not configured.");
  }

  const url = new URL("/api/flashnote/questions", baseUrl);
  if (params.quizId) url.searchParams.set("quizId", params.quizId);
  if (params.roadmapId) url.searchParams.set("roadmapId", params.roadmapId);
  if (params.topicId) url.searchParams.set("topicId", params.topicId);
  if (params.subjectId) url.searchParams.set("subjectId", params.subjectId);
  if (params.platformId) url.searchParams.set("platformId", params.platformId);
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch quiz questions.");
  }

  const data = (await response.json()) as QuizQuestionsResponse;
  if (!data || !Array.isArray(data.items)) {
    throw new Error("Quiz API returned an invalid response.");
  }

  return data;
};

export const fetchQuizSources = async (params: {
  token: string;
  q: string;
}): Promise<QuizSourcesResponse> => {
  const baseUrl = import.meta.env.QUIZ_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("Quiz API base URL is not configured.");
  }

  const url = new URL("/api/flashnote/sources", baseUrl);
  url.searchParams.set("q", params.q);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to fetch AI sources.");
  }

  const data = (await response.json()) as QuizSourcesResponse;
  if (!data || !Array.isArray(data.roadmaps)) {
    throw new Error("AI sources returned an invalid response.");
  }

  return data;
};
