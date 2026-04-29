import redis.asyncio as redis
from src.config import Config
from src.auth.utils import ACCESS_TOKEN_EXPIRY

# JTI blocklist TTL must always match the access token lifetime —
# importing from utils.py ensures they stay in sync automatically.
token_blocklist = redis.from_url(Config.REDIS_URL)


async def add_jti_to_blacklist(jti: str) -> None:
    await token_blocklist.set(name=jti, value="", ex=ACCESS_TOKEN_EXPIRY)


async def token_in_blocklist(jti: str) -> bool:
    jti = await token_blocklist.get(jti)
    return jti is not None
