"""AI Market Brief (planned, not implemented yet).

The brief will explain what a market is pricing in plain English. It will only
interpret numbers that services/analytics.py has already computed; the model never
does the math. The OpenAI key will come from the OPENAI_API_KEY environment
variable (see config.py) and is never sent to the browser.

No route calls this yet.
"""


def generate_market_brief(market, history_stats):
    raise NotImplementedError("The AI Market Brief is planned for a later step.")
