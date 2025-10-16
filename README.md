# Prompt Optimizer

AI-powered prompt optimization tool using Claude Sonnet 4.

## Quick Start

### Option 1: Run both servers together

```bash
./start.sh
```

### Option 2: Run servers separately

**Terminal 1 (Backend):**

```bash
npm run server
```

**Terminal 2 (Frontend):**

```bash
npm run dev
```

## Features

- 🤖 **AI-Powered**: Uses Claude Sonnet 4 for intelligent prompt optimization
- 📊 **Quality Scoring**: Tracks improvement metrics
- 💾 **History**: Saves your last 10 optimizations
- 📤 **Export**: Download as Text, Markdown, or JSON
- 🔄 **Toggle Mode**: Switch between AI and rule-based generation

## Usage

1. Enter your rough prompt in the left panel
2. Click "Optimize Prompt"
3. View the optimized version with quality score
4. Copy or export your optimized prompt

## Video Prompt Optimization

Generates optimized prompts for AI video platforms: Sora, Veo3, RunwayML, Kling, and Luma.

### What It Does

Transforms brief video concepts into structured 100-150 word prompts that include:
- Shot type and camera movement
- Subject details and action
- Lighting and setting
- Technical specifications
- 2-3 creative alternatives

### Template Structure

**[SHOT TYPE] [SUBJECT doing ACTION] in/at [SETTING], [CAMERA BEHAVIOR], [LIGHTING], [STYLE/MOOD]**

Elements (in priority order):
1. Shot type (wide, medium, close-up, extreme close-up)
2. Subject with 2-3 visual details
3. One clear action
4. Setting and time of day
5. Camera movement and angle
6. Lighting direction and quality
7. Film style reference

### How to Use

1. Select **Video Prompt** mode
2. Enter your video concept
3. Click **Optimize**
4. Use the generated prompt with AI video platforms

### Why 100-150 Words?

Testing shows this length works best for AI video models. Shorter prompts follow instructions more reliably than verbose descriptions.
