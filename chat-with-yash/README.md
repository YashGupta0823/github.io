A Flask API that runs the "Chat With Me" chatbot on my portfolio. It answers
questions using only real facts about my background (school, experience,
projects) with the Gemini API.
 
The  frontend keeps the full conversation in a array and calls POST /api/chat on every message the user
sends, and passing the whole message history each time. It renders the returned reply in the chat window, or shows the error message
if the request fails.

```bash
pip install -r requirements.txt
export GEMINI_API_KEY="your-key-here"
python3 app.py
```

