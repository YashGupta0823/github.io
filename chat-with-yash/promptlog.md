Prompt 1
Build a chatbot feature with a Flask backend that reads
my real site content to build a system prompt so it answers
questions using only real facts, plus a matching frontend chat.
Include input validation with the API key read from an environment variable so it's ready
for Render.

Built the Flask backend and chat UI and set it up to call the Anthropic API.

Prompt 2
Switch the backend from the Anthropic SDK to the OpenAI SDK, and add real
server side error logging before returning the generic error to the client, so
failures aren't silent.

Prompt 3
Switch the backend from OpenAI to Google's Gemini API instead, since it has a
no cost free tier. Verify the current SDK usage and a working model
directly against the installed package rather than assuming, and keep the
existing validation.

Prompt 4
Deploy the backend to Render, then point the frontend's API_BASE at the live
Render URL and confirm CORS is scoped correctly.
