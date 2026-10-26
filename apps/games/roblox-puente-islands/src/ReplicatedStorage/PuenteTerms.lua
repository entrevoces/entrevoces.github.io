-- PuenteTerms — AI-technology ES->EN terms (mirror of engine seed: ai-technology)
-- Regenerate when packages/engine-core/seed-data.js changes. Distractors are
-- real neighbor terms, never gibberish: confusion must be plausible to teach.
local Terms = {
	{ id = "machine-learning-model", es = "modelo de aprendizaje automático", en = "machine learning model",
		sentence = "El modelo de aprendizaje automático genera un borrador.", wrong = { "training data", "prompt", "token (language model)" } },
	{ id = "training-data", es = "datos de entrenamiento", en = "training data",
		sentence = "No entrenamos el modelo con tus mensajes de hoy.", wrong = { "inference (ML)", "embedding", "guardrails" } },
	{ id = "ai-hallucination", es = "alucinación (IA)", en = "hallucination (AI)",
		sentence = "El modelo puede alucinar citas que no existen.", wrong = { "fine-tuning", "prompt", "machine learning model" } },
	{ id = "prompt", es = "prompt", en = "prompt",
		sentence = "Escribe un prompt que primero dé un ejemplo.", wrong = { "token (language model)", "guardrails", "training data" } },
	{ id = "guardrails", es = "barreras de seguridad", en = "guardrails",
		sentence = "Las barreras de seguridad bloquean la solicitud.", wrong = { "embedding", "inference (ML)", "fine-tuning" } },
	{ id = "inference", es = "inferencia", en = "inference (ML)",
		sentence = "La inferencia tarda 200 milisegundos.", wrong = { "training data", "fine-tuning", "prompt" } },
	{ id = "token", es = "token", en = "token (language model)",
		sentence = "El plan incluye 4.000 tokens por respuesta.", wrong = { "prompt", "embedding", "hallucination (AI)" } },
	{ id = "embedding", es = "embedding / representación vectorial", en = "embedding",
		sentence = "La búsqueda compara embeddings, no palabras sueltas.", wrong = { "guardrails", "token (language model)", "inference (ML)" } },
	{ id = "fine-tuning", es = "ajuste fino", en = "fine-tuning",
		sentence = "El ajuste fino especializa el modelo.", wrong = { "inference (ML)", "prompt", "training data" } },
}
return Terms
