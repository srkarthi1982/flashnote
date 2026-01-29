type QuizQuestion = {
  questionId: string;
  questionText: string;
  answerText: string;
  explanation?: string | null;
  topicId?: string | null;
  subjectId?: string | null;
  difficulty?: string | null;
};

export type QuizQuestionsResponse = {
  items: QuizQuestion[];
};

export const fetchQuizQuestions = async (params: {
  token: string;
  quizId?: string;
  topicId?: string;
  limit?: number;
}): Promise<QuizQuestionsResponse> => {
  const baseUrl = import.meta.env.QUIZ_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("Quiz API base URL is not configured.");
  }

  const url = new URL("/api/flashnote/questions", baseUrl);
  if (params.quizId) url.searchParams.set("quizId", params.quizId);
  if (params.topicId) url.searchParams.set("topicId", params.topicId);
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
