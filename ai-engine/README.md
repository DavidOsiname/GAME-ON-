# GAME ON AI ENGINE — bootstrap branch

This isolated workspace is being developed on `ai-engine/bootstrap`; the existing `main` branch has not been modified.

The initial v0.1 foundation is packaged in `GAME_ON_AI_ENGINE_Source_v0.1.tar.xz`. Extract it inside this `ai-engine/` directory and follow the included README.

The foundation includes:
- Next.js dashboard for project creation, target platforms, and guided/automatic mode.
- FastAPI backend with project storage and GDD upload.
- Prompt-only or GDD-based development planning.
- OpenAI-compatible AI planner adapter.
- Clearly labelled rule-based preview when no AI API key is configured.
- API tests.

This is a development foundation, not a production-ready game generator. Unreal/Unity generation, durable workflow execution, asset generation, QA automation, and platform build workers remain later milestones. Console builds require authorized developer access; iOS builds require Apple signing and macOS/Xcode.
