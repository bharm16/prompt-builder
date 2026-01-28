# **Technical Report: Advanced Prompt Engineering & Optimization Architectures for Next-Generation AI Video Models (December 2025\)**

## **1\. Introduction: The Deterministic Shift in Generative Video**

The trajectory of generative video technology has shifted dramatically in the fourth quarter of 2025\. We have transitioned from the "stochastic generation" era—defined by the erratic, slot-machine nature of early latent diffusion models—into an era of **deterministic control** and **physical simulation**. For software engineers and systems architects building middleware for this ecosystem, this shift necessitates a fundamental re-evaluation of the prompt engineering pipeline. It is no longer sufficient to treat prompt optimization as a mere linguistic exercise of finding "magic words." Instead, the modern Prompt Optimization Engine (POE) must function as a translation layer that maps high-level user intent into model-specific, structured control signals.

This technical report provides an exhaustive analysis of the five dominant foundation models as of December 2025: **Runway Gen-4.5 Alpha**, **Luma Ray-3**, **Kling AI 2.6**, **OpenAI Sora 2**, and **Google Veo 4**. Our analysis is framed specifically for the development of a prompt optimization engine, focusing on the architectural divergences between these models. We observe a distinct bifurcation in design philosophy: while North American models like Luma Ray-3 and OpenAI Sora 2 are prioritizing "world simulation" through reasoning cores and physics engines, competitors like Kling AI (Kuaishou) and Google DeepMind are aggressively pursuing multimodal integration—specifically native audio synchronization and long-context narrative consistency.

The optimization engine of 2026 must be polymorphic. It must recognize that a prompt destined for Runway Gen-4.5 requires a different syntactic structure—emphasizing camera vectors and aesthetic precision—than a prompt destined for Luma Ray-3, which requires causal logic and reasoning chains. The following sections dissect these requirements in granular detail to support the implementation of robust normalization ("Strip") and augmentation ("Inject") logic.

## ---

**2\. Runway Gen-4.5 Alpha ("Whisper Thunder")**

**Release Status:** Alpha (December 2025\)

**Architecture:** Autoregressive-to-Diffusion (A2D) Hybrid

**Core Competency:** Visual Fidelity, Camera Control, and Temporal Morphing Resistance

Runway Gen-4.5, internally codenamed "Whisper Thunder" or "David," represents a significant departure from the pure diffusion architectures of Gen-2 and Gen-3 Alpha. The introduction of an **Autoregressive-to-Diffusion (A2D)** pipeline signals a move toward addressing the most persistent artifact in AI video: object permanence.1 In pure diffusion models, objects often "boil" or morph into other shapes because the model lacks a temporal understanding of the object's identity across frames. Gen-4.5 likely employs an autoregressive transformer to generate a low-resolution "token sequence" or "layout plan" for the video *before* the diffusion model begins painting pixels. This two-stage process locks in the scene's topology, ensuring that a "coffee cup" remains a "coffee cup" even as the camera rotates 180 degrees around it.2

### **2.1 Core Prompting Philosophy: The Cinematographic Structuralist**

The prompting philosophy required for Gen-4.5 is **Structural-Literalism**. Because the A2D architecture enforces a stricter adherence to the initial token sequence, the model is less forgiving of vague or impressionistic prompts compared to its predecessors. It demands a structured Scene Description Language (SDL) that mimics a director's shot list.

#### **The "Camera-Subject-Action-Environment" (CSAE) Protocol**

For the prompt optimization engine, the most effective strategy is to normalize user input into a rigid CSAE sequence. This sequence aligns with the model's likely attention mechanism, which parses spatial constraints (Camera) before semantic entities (Subject).

1. **Camera Choreography:** The model expects explicit definition of the "observer." This is not just about angle (e.g., "low angle"), but about the *mechanics* of the lens.  
2. **Subject Definition:** The primary entity must be described with invariant physical attributes to support the A2D's consistency checks.  
3. **Temporal Action:** The explicit transformation or movement occurring between $t=0$ and $t=end$.  
4. **Environmental Context:** Volumetric data, lighting, and atmospherics.

The optimization engine must parse a loose user prompt like "A cool shot of a cyberpunk girl walking in rain" and restructure it. The "cool shot" is semantically null; the engine must infer or inject a specific camera move. The "cyberpunk girl" requires attribute expansion to lock identity. The "walking" action needs a vector (e.g., "walking towards the camera").

Quality Boosters:  
Unlike previous models where "4k" or "8k" were placebo tokens, Gen-4.5 responds to technical cinematography terms. Triggers such as "chromatic aberration," "anamorphic lens flare," "shallow depth of field," and "production-ready" activate specific weights in the aesthetic classifier.3 The engine should actively inject these terms to force the model into its high-fidelity latent space. Conversely, terms like "morphing," "blur," and "distortion" are implicitly suppressed by the A2D architecture, but positive reinforcement (e.g., "consistent geometry") is beneficial.2

### **2.2 Advanced Control Mechanisms**

#### **2.2.1 Granular Camera Control Syntax**

Runway Gen-4.5 offers the most sophisticated camera control API on the market, treating the virtual camera as a physical object in 3D space. The prompt optimization engine must map user intent to specific vector parameters rather than relying on text embeddings alone.4

* **Pedestal (Y-Axis Translation):** Moving the camera vertically without tilting. Syntax: camera\_motion: "pedestal\_up". This is distinct from a "Tilt," which changes the horizon line.  
* **Truck (X-Axis Translation):** Lateral movement parallel to the subject. Syntax: camera\_motion: "truck\_left".  
* **Roll (Z-Axis Rotation):** Rotating the camera around the lens axis. This is a rare capability that allows for "Dutch angle" or disorienting effects.  
* **Zoom vs. Dolly (Z-Axis Depth):** The model distinguishes between optical zoom (focal length change) and physical dolly (camera movement). This distinction is critical for **Parallax Control**. A "Zoom" compresses the background, making it appear closer to the subject. A "Dolly" enhances depth perception as background objects move slower than foreground objects. The optimization engine should analyze the prompt for depth cues; if the user says "vertigo effect" or "background compression," the engine should select zoom. If the user says "depth" or "3D feel," it should select dolly.

#### **2.2.2 Object Consistency via Visual References**

Gen-4.5 utilizes a **Visual Reference** system (often tagged via @image or ref\_id in API calls) to lock character identity. The optimization engine must support a "Reference Injection" module.2

* **Mechanism:** The model calculates a CLIP (or SigLIP) feature vector from the reference image and injects it into the self-attention layers of the transformer blocks.  
* **Prompting Constraint:** The text prompt *must* re-describe the reference character. If the reference is a "man in a red hat," the text prompt must also say "man in a red hat." Omitting this causes "concept drift," where the text embedding overrides the visual embedding. The optimization engine must automatically generate a text description of the uploaded reference image (using a Vision-Language Model) and append it to the prompt to reinforce the attention map.6

### **2.3 Technical Constraints & Syntax**

| Feature | Specification | Engineering Implication | Source |
| :---- | :---- | :---- | :---- |
| **Max Token Limit** | 5,000 characters | Allows for extremely verbose, screenplay-level descriptions. | 7 |
| **Resolution** | 720p (Native), 4K Upscale | Native generation is lower res to support complex A2D compute; upscaling is a post-process. | 3 |
| **Frame Rate** | 24 fps (Fixed) | Cinematic standard; cannot generate 60fps gaming content natively. | 3 |
| **Aspect Ratios** | 16:9, 9:16 | Native training ratios; strictly enforced to prevent cropping artifacts. | 3 |
| **Cost** | 25 Credits/Second | High operational cost necessitates aggressive prompt validation before submission. | 8 |
| **Audio** | **No Native Audio** | Major competitive disadvantage; requires external audio pipeline. | 8 |

Negative Prompts:  
Runway Gen-4.5 does not natively support a negative\_prompt parameter in its V1 text-to-video API, relying instead on its high prompt adherence to exclude unmentioned elements. However, for image-to-video workflows, negative prompting is supported to suppress artifacts.9 The prompt builder logic must be context-aware: if the input is text-only, it must "Strip" negative constraints and "Inject" positive assertions of the inverse (e.g., transform "--no blur" to "sharp focus"). If the input includes an image, the negative prompt field can be populated.

### **2.4 Use-Case Specialization**

Runway Gen-4.5 is the specialized tool for **Commercial Advertising** and **High-End VFX**. Its physics engine excels at liquid simulation (e.g., pouring drinks, splashing water) and product shots where object permanence is non-negotiable.2 It is less suited for dialogue-heavy scenes due to the lack of native audio, but its visual fidelity is currently the benchmark for "b-roll" generation.

### **2.5 Implementation: Prompt Builder Logic (Gen-4.5)**

Normalization Rule: "The S.A.E. Sort"  
The optimization engine must parse the user's raw input and reorder clauses to match the model's preferred attention order.

1. **Extract** camera terms (e.g., "pan left", "zoom in") and move them to a camera\_motion JSON object if using the API, or to the absolute start of the string if using the web UI.  
2. **Identify** the Subject (S) and Action (A) using Named Entity Recognition (NER).  
3. **Construct** the normalized prompt string: \[Action\]\[Environment\].

**Strip & Inject Rules:**

* **Strip:** Ambiguous emotional words ("vibe," "feeling") unless they can be translated into lighting conditions (e.g., "sad" \-\> "blue hour, low key lighting").  
* **Inject:** "Single continuous shot." This is a critical injection for Gen-4.5. Without it, the model often cuts to black or changes angles mid-clip, effectively hallucinating a scene cut where none was requested.8  
* **Inject:** "Fluid motion" and "consistent physics" to activate the superior motion priors of the A2D architecture.

## ---

**3\. Luma Ray-3**

**Release Status:** Public (September 2025\)

**Architecture:** Reasoning-Based Diffusion Transformer

**Core Competency:** High Dynamic Range (HDR) Output, Causal Physics, and Keyframe Interpolation

Luma Ray-3 distinguishes itself fundamentally through its **Reasoning Core** and **Native HDR Pipeline**.11 While other models generate pixels based on surface-level semantic matching, Ray-3 appears to perform a pre-generation "planning" step. This chain-of-thought process allows the model to "understand" physics and causality before committing to a pixel generation path. Furthermore, it is the only model currently capable of outputting **16-bit ACES colorspace** video, making it the solitary choice for professional color grading workflows in Hollywood pipelines.

### **3.1 Core Prompting Philosophy: Causal Reasoning**

The prompting philosophy for Ray-3 is **Intent-Based and Causal**. The model responds significantly better when the prompt explains the *why* and *how* of a scene, rather than just the *what*. This is a direct consequence of its reasoning architecture.

#### **The "Chain-of-Thought" Prompt Structure**

Users should be encouraged to describe the causal logic of the event.

* **Weak Prompt:** "A glass falls and breaks."  
* **Strong Prompt:** "Gravity pulls the glass off the edge of the table, causing it to accelerate downwards. It strikes the hard floor, shattering into shards upon impact due to the force."

**Engineering Implication:** The prompt optimization engine should utilize an intermediate LLM layer (e.g., GPT-4o) to "expand" user prompts into these causal chains. If a user inputs "car crash," the optimizer should expand this to "A speeding car loses traction on wet pavement, skidding sideways and colliding with a barrier, causing the metal to crumple and glass to shatter".11

### **3.2 Advanced Control Mechanisms**

#### **3.2.1 Native HDR & Color Control**

Luma Ray-3's most unique feature is its ability to generate **Linear EXR** sequences in the ACES2065-1 color space.13 This is not a filter; the model generates pixel values that exceed 1.0 (super-white), containing true lighting information.

* **Prompt Syntax:** To trigger this pipeline, the prompt must explicitly request it. Keywords include: "High Dynamic Range," "16-bit color," "ACES colorspace," "Deep shadows," and "Unclipped highlights."  
* **Lighting Physics:** Because the model renders in HDR, prompts involving light sources (e.g., "neon sign," "sun flare") will generate actual high-luminance pixel values. The optimization engine should inject specific lighting terminologies (e.g., "Rembrandt lighting," "volumetric god rays") to leverage this dynamic range.

#### **3.2.2 First-to-Last Frame Interpolation (Keyframes)**

Ray-3 allows users to define the start state (frame0) and the end state (frame1) of a video, leaving the model to interpolate the trajectory between them.15

* **JSON Structure:**  
  JSON  
  "keyframes": {  
    "frame0": { "type": "image", "url": "s3://bucket/start.jpg" },  
    "frame1": { "type": "image", "url": "s3://bucket/end.jpg" }  
  }

* **Looping:** The API supports a loop: true boolean. When enabled, the model forces the final frame to be perceptually coherent with the start frame, allowing for seamless infinite loops.  
* **Constraint:** The motion between start and end must be *physically plausible* within the generated duration (5s or 9s). If the displacement is too large (e.g., a person is in New York in frame0 and Paris in frame1), the reasoning core will likely reject the prompt or hallucinate a "teleportation" artifact. The optimization engine should warn users if the semantic distance between keyframes is too high.

### **3.3 Technical Constraints & Syntax**

| Feature | Specification | Engineering Implication | Source |
| :---- | :---- | :---- | :---- |
| **Max Prompt Length** | 5,000 characters | Allows for detailed causal descriptions. | 15 |
| **Resolution** | 1080p (Native), 4K Upscale | High enough for broadcast, requires upscale for cinema. | 17 |
| **Durations** | 5s, 9s (Extendable to 20s) | Shorter base clips require extensions for long scenes. | 15 |
| **HDR Format** | 10, 12, 16-bit EXR (ACES) | Requires specialized viewing software (Nuke/Resolve). | 13 |
| **API Rate Limit** | Tiered (\~5000/month Standard) | Strictly enforced; requires queue management middleware. | 18 |

Negative Prompts:  
Luma Ray-3 creates "concepts" via negative feedback training but does not expose a direct negative\_prompt string in its standard generations/create endpoint. Instead, unwanted elements must be suppressed by strictly defining the positive constraints or using the "Modify" endpoint (Inpainting) to remove them in post-generation.11 The prompt engine must therefore rely on "exclusion by inclusion"—specifying "clear blue sky" to prevent "clouds."

### **3.4 Use-Case Specialization**

Luma Ray-3 is the undisputed champion for **Virtual Production** and **Color Grading Workflows**.

* **LED Volumes:** Its ability to match the dynamic range of physical cameras makes it ideal for background plate generation.14  
* **VFX Compositing:** The EXR output allows compositors to crush blacks or blow out highlights in post without banding artifacts.20

### **3.5 Implementation: Prompt Builder Logic (Ray-3)**

Normalization Rule: "The Causal Link"  
The engine should analyze the prompt for static descriptions and convert them into active, causal descriptions.

* *Input:* "A man standing in the rain."  
* *Normalized:* "A man stands as rain falls around him, droplets colliding with his shoulders and creating splashes." (Injects physics interaction).

**Strip & Inject Rules:**

* **Inject:** "16-bit HDR," "EXR output" into the style section to trigger the high-fidelity rendering pipeline.  
* **Inject:** "Slow motion" or "High-speed camera." These terms trigger specific temporal interpolation weights in Ray-3, significantly improving the smoothness of the motion.21  
* **Strip:** "Loop" or "Seamless" from the text prompt if the loop: true API parameter is being used, to avoid conflicting instructions.

## ---

**4\. Kling AI 2.6**

**Release Status:** Public (Late 2025\)

**Architecture:** Multimodal Diffusion Transformer (MDT) with "MemFlow"

**Core Competency:** Native Audio-Visual Sync, Long-Context Memory, and Human Performance

Kling AI 2.6 (Kuaishou) is the "Performance Beast" of the current generation. Its defining feature is the **MemFlow** mechanism, which allows for long-context memory with limited capacity, enabling coherent multi-shot generations and extended clips up to 2 minutes.22 Furthermore, it is a fully multimodal model, generating synchronized audio (dialogue, SFX, music) in a single pass, a capability that places it ahead of Runway and Luma in terms of "finished product" generation.23

### **4.1 Core Prompting Philosophy: The Audio-Visual Script**

Prompting Kling 2.6 is akin to writing a screenplay or a stage script. The optimization engine must handle **Dual-Modality Prompting**, creating a unified description that governs both the visual and auditory latents.

#### **The "Dialogue-Action-Audio" Protocol**

Prompts must be structured to explicitly link sound to motion.

* **Integrated Sensory Description:** Prompts must describe what is seen *and* what is heard simultaneously.  
* **Dialogue Formatting:** Kling recognizes specific syntax for dialogue generation to ensure lip-sync accuracy.  
  * *Syntax:* Character Name: "Dialogue text".24  
  * *Tone Tags:* (angry), (whispering), (singing) before the dialogue line guide the prosody of the generated voice.23

### **4.2 Advanced Control Mechanisms**

#### **4.2.1 Native Audio Generation**

Kling 2.6 generates audio waveforms effectively "inside" the video generation process, ensuring frame-perfect synchronization (e.g., a footstep sound occurring exactly when the heel touches the ground).

* **SFX Triggers:** Specific keywords trigger the audio engine: "Heavy Beat," "Construction Noise," "Thunder," "Friction/Rubbing".25  
* **Musical Control:** The model understands musical genres and styles. Prompts can specify Music: \[Genre\],, \[Mood\]. It even supports rap and singing capabilities.23  
* **Optimization Constraint:** Audio generation consumes significant inference compute. The Prompt Optimization Engine should allow users to toggle audio off to save credits/time for draft iterations.

#### **4.2.2 "MemFlow" and Long-Context Consistency**

The **MemFlow** architecture utilizes an adaptive retrieval mechanism to fetch relevant historical frames from a memory bank.22 This solves the "amnesia" problem where a character changes clothes or appearance after walking off-screen.

* **Prompt Strategy:** To leverage MemFlow, the prompt for extended clips must reference "established elements."  
  * *Example:* "The same man from the beginning enters the room..."  
  * *Mechanism:* The model retrieves the feature vector of "the man" from the t=0 memory block and applies the new "enters room" action. The prompt engine must track these entities across extended generation sessions.

#### **4.2.3 Elements System (Multi-Angle Reference)**

Kling O1/2.6 allows uploading up to 4 images as an "Element" to define a subject from multiple angles (front, side, back).26 This is superior to single-image references as it provides a 3D understanding of the subject.

* **Syntax:** @Element1, @Element2 in the prompt.  
  * *Example:* "Change the car in @Video to @Element1."  
* **Engineering Note:** The optimization engine must manage an asset library. It needs to upload images to Kling's asset endpoint, retrieve the Element IDs, and then inject these IDs into the text prompt string.27

### **4.3 Technical Constraints & Syntax**

| Feature | Specification | Engineering Implication | Source |
| :---- | :---- | :---- | :---- |
| **Max Duration** | Up to 2 minutes (via extensions) | Enable "Story Mode" in UI to manage extensions. | 28 |
| **Resolution** | 1080p | Standard HD; sufficient for social, low for cinema. | 29 |
| **Audio** | Native (Lip-sync, Music, SFX) | Requires parsing dialogue from prompt text. | 23 |
| **Inputs** | Text, Image, Video, "Elements" | Multimodal input pipeline required. | 30 |
| **Negative Prompt** | **Supported** (Audio & Video) | Allows for precise artifact control. | 31 |

Negative Prompts:  
Kling supports explicit negative prompting for both video and audio. This is a significant advantage for fine-tuning.

* *Audio Negatives:* "background noise," "mumble," "overlapping speech," "distortion," "electronic interference".31  
* *Video Negatives:* "blur," "distortion," "morphing," "extra limbs," "bad anatomy."

### **4.4 Use-Case Specialization**

Kling 2.6 is the specialized tool for **Music Videos** and **Narrative Content with Dialogue**.

* **Lip-Sync:** It is the only model in this list capable of generating convincing dialogue and singing without external tools like HeyGen or SyncLabs.23  
* **Continuous Storytelling:** MemFlow makes it the only viable option for generating scenes longer than 10-20 seconds that require strict continuity.22

### **4.5 Implementation: Prompt Builder Logic (Kling 2.6)**

**Normalization Rule: "The Screenplay Formatter"**

1. **Separate** Dialogue from Action using regex.  
2. **Format** Dialogue: \[Character\] (\[Emotion\]): "\[Line\]"  
3. **Format** Audio Cues: Audio:, \[Ambience\].  
4. **Inject** into the prompt string: ... Action description. Audio:... Dialogue:...

**Strip & Inject Rules:**

* **Inject:** "Synced lips," "natural speech," "high fidelity audio" to enforce the lip-sync module's precision.  
* **Strip:** General audio terms like "sound" or "noise" if specific SFX are provided, to prevent the model from generating vague white noise layers.  
* **Strip:** "4k" or "8k" from the *audio* description portion of the prompt, as these are visual tokens that confuse the audio encoder.

## ---

**5\. OpenAI Sora 2**

**Release Status:** Invited Access / Pro (Late 2025\)

**Architecture:** Spacetime Patch-based Diffusion Transformer

**Core Competency:** Physics Simulation, World Consistency, and "Cameo" Privacy

Sora 2 expands on the original "world simulator" promise of Sora 1\. While other models focus on "video generation" (creating images that move), Sora 2 focuses on "simulation" (calculating the state of a world over time). It is characterized by **superior physics simulation**—gravity, momentum, fluid dynamics, and collision detection are handled with near-Newtonian accuracy.32 It also introduces a privacy-centric feature called "Cameo" for likeness integration.

### **5.1 Core Prompting Philosophy: The Simulation Configuration**

Prompting Sora 2 is less about directing a camera and more about defining the **Initial State** and the **Rules of Interaction**.

* **Physics-First Prompting:** Prompts should explicitly state physical properties to guide the simulation. Descriptors like "heavy mass," "high friction," "elastic collision," and "fragile material" help the model resolve interactions correctly.34  
* **Temporal Segmentation:** Sora 2 handles complex, multi-shot sequences within a single generation better than its competitors. It understands "film grammar" and editing.  
  * *Syntax:* Sequence: Shot 1 (0-4s):. Cut to Shot 2 (4-8s):..35

### **5.2 Advanced Control Mechanisms**

#### **5.2.1 Native Audio & Dialogue**

Like Kling, Sora 2 generates synchronized audio. However, its strength lies in environmental accuracy (e.g., the specific sound of sneakers squeaking on a basketball court) rather than just speech.

* **Dialogue Block:** The API expects a dialogue object or a specific text block format: Dialogue:: "".36  
* **Constraint:** OpenAI recommends keeping dialogue short (1-2 lines per 4-second clip) to maintain sync accuracy. Long monologues tend to drift.36

#### **5.2.2 "Cameo" and Character Locking**

Sora 2 introduces "Cameo," a feature that allows users to verify their identity via a short video selfie and then insert themselves into generated videos.33

* **Privacy & Safety:** Unlike Kling's @Element, Cameo is heavily restricted. It does not allow uploading arbitrary images of celebrities or non-consenting individuals. The prompt must not violate "Likeness" policies.  
* **Optimization Strategy:** The engine must implement a "Blocked Terms List" (BTL) containing names of celebrities and public figures. If a user prompts for "Taylor Swift," the engine must flag this as a likely API rejection and suggest using generic descriptors ("a pop star with blonde hair").37

#### **5.2.3 Structured Outputs (JSON)**

Sora 2's API supports response\_format: { type: "json\_object" }. This is crucial for the POE, as it allows the model to return metadata *about* the generated video (e.g., "detected\_objects," "camera\_movement\_used," "physics\_confidence\_score"). This metadata can be used to inform feedback loops and automated retry logic.38

### **5.3 Technical Constraints & Syntax**

| Feature | Specification | Engineering Implication | Source |
| :---- | :---- | :---- | :---- |
| **Max Token Limit** | Varies (200-300 words rec.) | Conciseness is preferred over verbosity. | 39 |
| **Resolutions** | 1280x720, 1024x1792 (Pro) | Vertical video is a native first-class citizen. | 39 |
| **Durations** | 4s, 8s, 12s (Discrete steps) | Prompt engine must snap user requests to these bins. | 39 |
| **API Params** | extra\_body={"aspect": "..."} | Aspect ratio is a hard parameter, not a prompt token. | 40 |
| **Safety** | Strict (C2PA, Copyright filters) | Aggressive pre-filtering of prompts is required. | 41 |

Negative Prompts:  
Sora 2's API (v1/chat/completions style) does not standardize a negative\_prompt field in the same way Stable Diffusion does. Instead, it relies on System Prompts or extra\_body parameters depending on the specific wrapper/endpoint.42 However, the primary method for exclusion is Positive Constraints. Instead of "no furniture," the prompt should say "an empty, barren room."

### **5.4 Use-Case Specialization**

Sora 2 is the tool for **Social Media Viral Content** and **Simulation Training**.

* **TikTok/Reels:** The "Cameo" feature combined with native vertical resolution makes it the ultimate personal content engine.43  
* **Synthetic Data:** Its adherence to physics makes it suitable for generating training data for robotics or autonomous driving, where the "laws of nature" must be respected.33

### **5.5 Implementation: Prompt Builder Logic (Sora 2\)**

**Normalization Rule: "The Physical Grounding"**

1. **Scan** for physical interactions (collisions, falling, flowing).  
2. **Inject** physics modifiers: "Newtonian physics," "accurate collision," "momentum conservation," "surface friction".32  
3. **Format** Multi-shot sequences into a structured list: Sequence: Shot 1 (...) \-\> Shot 2 (...).

**Strip & Inject Rules:**

* **Strip:** Copyrighted character names (e.g., "Mickey Mouse") unless the account has a specific enterprise license (e.g., Disney Partnership).37  
* **Inject:** response\_format: { type: "json\_object" } in the API call to enable structured metadata return.  
* **Inject:** "Photorealistic," "4k," "highly detailed" into the style section, as Sora 2 defaults to a neutral style without these boosters.

## ---

**6\. Google Veo 4**

**Release Status:** Late 2025 (Projected/Alpha)

**Architecture:** Transformer-based Latent Diffusion with Gemini Integration

**Core Competency:** Long-Form Narrative, Enterprise Integration, and JSON Control

Google Veo 4 represents the convergence of Large Language Model reasoning (Gemini) and video generation. It excels in **Long-Form Narrative** (30s+ clips) and **JSON-Structured Control**. It is deeply integrated into the Vertex AI ecosystem, allowing for complex enterprise workflows where video generation is just one step in a larger automated pipeline.44

### **6.1 Core Prompting Philosophy: The Structured Data Object**

Veo 4 moves away from natural language prose towards **JSON-Based Prompting**. This allows for precise control over multiple attributes (camera, lighting, subject, audio) simultaneously without the ambiguity of natural language syntax.46

#### **The JSON Schema**

The optimization engine should generate prompts in a structured format rather than a string. This structure leverages Gemini's parsing capabilities to map intents to video latents directly.

JSON

{  
  "subject": {   
    "description": "A silver robot with glowing blue eyes",   
    "action": "walking through a desert storm"   
  },  
  "camera": {   
    "type": "drone",   
    "movement": "orbit",   
    "speed": "fast"   
  },  
  "environment": {   
    "lighting": "golden hour",   
    "weather": "sandstorm",   
    "particles": "heavy"   
  },  
  "audio": {   
    "dialogue": "System critical.",   
    "ambience": "howling wind"   
  }  
}

### **6.2 Advanced Control Mechanisms**

#### **6.2.1 "Flow" Editing**

Veo 4 supports "Flow," a node-based editing workflow.47 This allows users to iteratively refine a video without regenerating it from scratch.

* **Edit Prompts:** "Remove the boom mic," "Change the time of day to night," "Make the character smile."  
* **Masking:** Veo 4 can accept mask images or define masks via text (e.g., "mask the sky") to limit changes to specific regions.  
* **Optimization:** The engine should support a "Session State" to track the video history, enabling "Edit this video..." prompts.

#### **6.2.2 Vertex AI Integration (RAG)**

Veo 4 prompts can be augmented by **Retrieval-Augmented Generation (RAG)**. The optimization engine can inject context from a user's private document store (e.g., a brand style guide or a script database) into the Veo prompt context via Vertex AI.48

* **Use Case:** A brand can upload their "Brand Guidelines.pdf" to Vertex. When generating a video, the prompt engine can retrieve the exact hex codes for brand colors and inject them into the JSON environment field.

### **6.3 Technical Constraints & Syntax**

| Feature | Specification | Engineering Implication | Source |
| :---- | :---- | :---- | :---- |
| **Max Duration** | 30s+ (Projected) | Enables short-film creation in single passes. | 45 |
| **Resolution** | 4K (Native) | Best-in-class resolution without upscaling. | 44 |
| **Input Format** | Text, Image, JSON, Video | JSON is the preferred control format. | 46 |
| **Audio** | Native, High Fidelity | Supports complex soundscapes defined in JSON. | 44 |
| **Safety** | SynthID Watermarking | Invisible watermarks are mandatory. | 49 |

Negative Prompts:  
Veo 4 supports negative prompts via a specific JSON field: {"negative\_prompt": "..."}.

* **Standard Negatives:** "text overlays," "watermarks," "distorted hands," "camera shake," "low resolution," "compression artifacts".50

### **6.4 Use-Case Specialization**

Veo 4 is the **Enterprise Marketing** engine. Its integration with Google Workspace and YouTube Shorts makes it the go-to for automated ad generation at scale.48 Its ability to maintain coherence over 30-second clips allows for the creation of entire commercial spots without the need for constant stitching in post-production.44

### **6.5 Implementation: Prompt Builder Logic (Veo 4\)**

**Normalization Rule: "The JSON Serializer"**

1. **Parse** User Input (Natural Language).  
2. **Map** to Schema: Identify entities, actions, camera moves, and audio cues using an NLP parser.  
3. **Serialize** to JSON: Construct the structured payload for the Vertex AI endpoint.

**Strip & Inject Rules:**

* **Inject:** style\_preset: "cinematic" or style\_preset: "anime" based on keyword detection in the user prompt.  
* **Strip:** Markdown formatting or conversational filler ("Can you please make...") before serialization, as the JSON parser expects clean data.  
* **Inject:** negative\_prompt fields with standard quality assurance terms ("blur", "distortion") automatically.

## ---

**7\. Comparative Analysis Matrix**

The following table summarizes the key technical differentiators for the Prompt Optimization Engine logic.

| Feature Domain | Runway Gen-4.5 | Luma Ray-3 | Kling AI 2.6 | OpenAI Sora 2 | Google Veo 4 |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Primary Strength** | Visual Fidelity & Control | HDR Color & Lighting | Audio-Visual Sync | Physics Simulation | Long Context & Enterprise |
| **Prompt Style** | Structured (S-A-E) | Reasoning/Causal | Screenplay/Script | Physics/Simulation | JSON/Data |
| **Native Audio** | No | No | **Yes (Best)** | Yes | Yes |
| **Physics Accuracy** | High (Object Perm.) | High (Causal) | High (Body Dynamics) | **Highest (World Sim)** | High |
| **Max Duration** | 10s | 9s (Ext. 20s) | **2 mins** | 12s | 30s+ |
| **API Cost** | $$$(25 credits/s) | $$ | $ | $$ | $$ (Enterprise) |
| **Negative Prompts** | I2V Only | Concept-based | **Explicit** | System Prompt | **JSON Field** |

## ---

**8\. Architecture for the Prompt Optimization Engine (POE)**

Based on the deep dive above, the Prompt Optimization Engine (POE) must be architected as a **Middleware Layer** with model-specific adapters. It cannot be a simple text pass-through.

### **8.1 The Normalization Layer (Strip & Inject)**

The core logic of the POE is the **Transformation Pipeline**. It applies Strip and Inject operations based on the target model.

#### **8.1.1 Strip Rules**

* **Safety Stripping:** All models (especially Sora 2 and Veo 4\) have strict safety filters. The engine must pre-scan prompts for NSFW, violence, or extensive public figure likenesses and strip them to prevent API bans and account suspensions.37  
* **Redundancy Stripping:** Remove "4k," "8k," "high quality" for models like Gen-4.5 and Ray-3 where high fidelity is intrinsic and these tokens waste context window. *Keep* these for Kling/Veo where they act as active quality boosters.52  
* **Syntax Stripping:** Detect \--no \[item\] syntax (common in Midjourney prompts).  
  * *For Kling/Veo:* Move \[item\] to the negative\_prompt field.  
  * *For Runway/Luma:* Convert to a positive linguistic constraint (e.g. "--no blur" \-\> "sharp focus", "--no dark" \-\> "brightly lit").

#### **8.1.2 Inject Rules**

* **Context Injection:**  
  * *For Luma:* Inject "High Dynamic Range, 16-bit colors" to force the HDR pipeline.  
  * *For Kling:* Inject "native audio," "ambient sound" if the user prompt implies sound but doesn't explicitly request it.  
* **Quality Boosters:**  
  * *Universal:* "Cinematic lighting," "shallow depth of field."  
  * *Model-Specific:*  
    * Runway: "Fluid motion," "no morphing."  
    * Sora: "Physically accurate," "Newtonian physics."

### **8.2 The "Multimodal Assembler"**

Since models like Kling and Runway Gen-4.5 support image/video inputs (@Element, @Image), the POE must possess a **Media Asset Manager**.

1. **Upload:** User uploads an image via the POE frontend.  
2. **Host:** POE hosts the image or sends it to the model's asset endpoint (e.g., fal.ai/storage for Kling via FAL).  
3. **Tokenize:** Receive the UUID/Token from the model API.  
4. **Inject:** Replace the local file reference in the prompt with the API-specific token (e.g., @Element1) before sending the final request.

### **8.3 Advanced Feature: "Cross-Model Translation"**

The ultimate value of the POE is the ability to translate a single user intent into optimized prompts for *all* models simultaneously.

* *User Input:* "A cyberpunk city street, raining, neon lights, 4k."  
* *POE Output (Runway):* "Camera: Truck forward. Subject: Cyberpunk city street. Environment: Rain, neon lights, volumetric fog. Style: Photorealistic, 4k."  
* *POE Output (Kling):* "A cyberpunk city street with neon lights. Audio: Rain falling, distant sirens, neon hum. High quality, 4k."  
* *POE Output (Luma):* "Neon lights illuminate a wet cyberpunk street. Raindrops create ripples in puddles (physics). 16-bit HDR, ACES colorspace."  
* *POE Output (Sora):* "Sequence: Wide shot of cyberpunk city (0-4s). Physics: Rain interactions with pavement. Style: 4k, photorealistic."  
* *POE Output (Veo):* {"scene": "cyberpunk city", "environment": "rain", "lighting": "neon"}.

## **9\. Conclusion**

As of December 2025, the AI video generation market has segmented into specialized niches. **Runway Gen-4.5** is the tool for precision and VFX control; **Luma Ray-3** owns the high-fidelity color pipeline; **Kling AI 2.6** dominates audio-visual performance and long-form consistency; **Sora 2** provides the most accurate physical simulation; and **Google Veo 4** offers enterprise-grade scale and integration.

For a software engineer building a Prompt Optimization Engine, the key lies not just in text manipulation, but in **structural normalization**. The engine must treat prompts as structured data objects—managing camera parameters, assets, and audio cues—rather than simple text strings. Success depends on abstracting these divergent API requirements into a unified "Director Intent" interface that dynamically adapts to the constraints and strengths of each underlying model.

#### **Works cited**

1. Runway Gen-4.5 Overview | ImagineArt, accessed December 29, 2025, [https://www.imagine.art/blogs/runway-gen-4-5-overview](https://www.imagine.art/blogs/runway-gen-4-5-overview)  
2. Introducing Runway Gen-4, accessed December 29, 2025, [https://runwayml.com/research/introducing-runway-gen-4](https://runwayml.com/research/introducing-runway-gen-4)  
3. Creating with Gen-4.5 \- Runway, accessed December 29, 2025, [https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5](https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5)  
4. Camera Terms, Prompts, & Examples \- Runway, accessed December 29, 2025, [https://help.runwayml.com/hc/en-us/articles/46749315925395-Camera-Terms-Prompts-Examples](https://help.runwayml.com/hc/en-us/articles/46749315925395-Camera-Terms-Prompts-Examples)  
5. Runway Advanced Camera Controls | Ultimate Guide & Tips \- YouTube, accessed December 29, 2025, [https://www.youtube.com/watch?v=3pHu1mxOjp8](https://www.youtube.com/watch?v=3pHu1mxOjp8)  
6. How to Keep Characters Consistent Across AI Scenes: Working Prompt Patterns (2025), accessed December 29, 2025, [https://skywork.ai/blog/how-to-consistent-characters-ai-scenes-prompt-patterns-2025/](https://skywork.ai/blog/how-to-consistent-characters-ai-scenes-prompt-patterns-2025/)  
7. POST gen4\_5/create | Experimental API for AI services \- UseAPI.net, accessed December 29, 2025, [https://useapi.net/docs/api-runwayml-v1/post-runwayml-gen4\_5-create](https://useapi.net/docs/api-runwayml-v1/post-runwayml-gen4_5-create)  
8. Runway Gen 4.5: The Best Text-to-Video Model Yet? | DataCamp, accessed December 29, 2025, [https://www.datacamp.com/tutorial/runway-gen-4-5](https://www.datacamp.com/tutorial/runway-gen-4-5)  
9. Wan 2.6 Prompt Guide: Mastering Three Generation Modes | fal.ai, accessed December 29, 2025, [https://fal.ai/learn/devs/wan-2-6-prompt-guide-mastering-all-three-generation-modes](https://fal.ai/learn/devs/wan-2-6-prompt-guide-mastering-all-three-generation-modes)  
10. Someone tell runway to please make negative prompts available in gen 3 they seemingly arnt or haven't please tell them : r/runwayml \- Reddit, accessed December 29, 2025, [https://www.reddit.com/r/runwayml/comments/1fidow4/someone\_tell\_runway\_to\_please\_make\_negative/](https://www.reddit.com/r/runwayml/comments/1fidow4/someone_tell_runway_to_please_make_negative/)  
11. Alibaba Yunqi: 7 models released in 4 days (Qwen3-Max, Qwen3-Omni, Qwen3-VL) and $52B roadmap | AINews, accessed December 29, 2025, [https://news.smol.ai/issues/25-09-23-alibaba-yunqi/](https://news.smol.ai/issues/25-09-23-alibaba-yunqi/)  
12. AI Video Generation with Ray3 & Dream Machine \- Luma AI, accessed December 29, 2025, [https://lumalabs.ai/ray](https://lumalabs.ai/ray)  
13. HDR EXR to Premiere Pro: A 2025 Workflow for Color-Grading Luma Ray3 Footage in ACES \- My Framer Site \- Sima Labs, accessed December 29, 2025, [https://www.simalabs.ai/resources/hdr-exr-premiere-pro-2025-workflow-color-grading-luma-ray3-aces](https://www.simalabs.ai/resources/hdr-exr-premiere-pro-2025-workflow-color-grading-luma-ray3-aces)  
14. Ray3 brings 16-bit HDR generative video \- now in Adobe Firefly \- fxguide, accessed December 29, 2025, [https://www.fxguide.com/quicktakes/ray3-brings-16-bit-hdr-generative-video-now-in-adobe-firefly/](https://www.fxguide.com/quicktakes/ray3-brings-16-bit-hdr-generative-video-now-in-adobe-firefly/)  
15. Luma AI models \- Amazon Bedrock \- AWS Documentation, accessed December 29, 2025, [https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-luma.html](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-luma.html)  
16. Video Generation \- Luma AI, accessed December 29, 2025, [https://docs.lumalabs.ai/docs/javascript-video-generation](https://docs.lumalabs.ai/docs/javascript-video-generation)  
17. Luma AI Launches Ray3: The World's First Reasoning Video Model and the First to Generate High-fidelity 16-Bit HDR \- Business Wire, accessed December 29, 2025, [https://www.businesswire.com/news/home/20250918470219/en/Luma-AI-Launches-Ray3-The-Worlds-First-Reasoning-Video-Model-and-the-First-to-Generate-High-fidelity-16-Bit-HDR](https://www.businesswire.com/news/home/20250918470219/en/Luma-AI-Launches-Ray3-The-Worlds-First-Reasoning-Video-Model-and-the-First-to-Generate-High-fidelity-16-Bit-HDR)  
18. Video Generation \- Luma AI, accessed December 29, 2025, [https://docs.lumalabs.ai/docs/video-generation](https://docs.lumalabs.ai/docs/video-generation)  
19. AI Fire Daily \- Rss, accessed December 29, 2025, [https://media.rss.com/ai-fire-daily/feed.xml](https://media.rss.com/ai-fire-daily/feed.xml)  
20. ETC's 'The Bends' Cracks AI Video Cinema Code with 16-Bit HDR Pipeline \- VP Land, accessed December 29, 2025, [https://www.vp-land.com/p/etc-s-the-bends-cracks-ai-video-cinema-code-with-16-bit-hdr-pipeline](https://www.vp-land.com/p/etc-s-the-bends-cracks-ai-video-cinema-code-with-16-bit-hdr-pipeline)  
21. Luma AI Ray3 Model: Unlock Creative Workflows with The Reasoning AI \- CapCut, accessed December 29, 2025, [https://www.capcut.com/resource/luma-ray-3/](https://www.capcut.com/resource/luma-ray-3/)  
22. Official Implementation of "MemFlow: Flowing Adaptive Memory for Consistent and Efficient Long Video Narratives" \- GitHub, accessed December 29, 2025, [https://github.com/KlingTeam/MemFlow](https://github.com/KlingTeam/MemFlow)  
23. Kling 2.6 is Live \- Native Audio Video Model | VEED \- VEED.IO, accessed December 29, 2025, [https://www.veed.io/ai-models/video/kling-2-6](https://www.veed.io/ai-models/video/kling-2-6)  
24. Kling 2.6 AI Video Model Guide: Audio \+ Video in One Pass | insMind, accessed December 29, 2025, [https://www.insmind.com/blog/kling-2-6-ai-video-overview/](https://www.insmind.com/blog/kling-2-6-ai-video-overview/)  
25. KLING VIDEO 2.6 User Guide, accessed December 29, 2025, [https://app.klingai.com/global/quickstart/klingai-video-26-audio-user-guide](https://app.klingai.com/global/quickstart/klingai-video-26-audio-user-guide)  
26. Kling O1 Model Family: The Essentials | Scenario Help, accessed December 29, 2025, [https://help.scenario.com/en/articles/kling-o1-family-the-essentials/](https://help.scenario.com/en/articles/kling-o1-family-the-essentials/)  
27. Kling O1: Reference Image to Video Generator | fal.ai, accessed December 29, 2025, [https://fal.ai/models/fal-ai/kling-video/o1/reference-to-video](https://fal.ai/models/fal-ai/kling-video/o1/reference-to-video)  
28. Luma Dream Machine: My Deep Dive into the AI Video Generator Changing the Game, accessed December 29, 2025, [https://skywork.ai/skypage/en/Luma-Dream-Machine:-My-Deep-Dive-into-the-AI-Video-Generator-Changing-the-Game/1974360974881255424](https://skywork.ai/skypage/en/Luma-Dream-Machine:-My-Deep-Dive-into-the-AI-Video-Generator-Changing-the-Game/1974360974881255424)  
29. Kling 2.6 vs Veo 3.1: A Complete Video Model Breakdown \- SeaArt AI, accessed December 29, 2025, [https://www.seaart.ai/blog/kling-2.6-vs-veo-3.1](https://www.seaart.ai/blog/kling-2.6-vs-veo-3.1)  
30. KLING VIDEO O1 User Guide, accessed December 29, 2025, [https://app.klingai.com/global/quickstart/klingai-video-o1-user-guide](https://app.klingai.com/global/quickstart/klingai-video-o1-user-guide)  
31. How to Actually Control Next-Gen Video AI: Runway, Kling, Veo, and Sora Prompting Strategies | by Kristopher Dunham | Dec, 2025 | Medium, accessed December 29, 2025, [https://medium.com/@creativeaininja/how-to-actually-control-next-gen-video-ai-runway-kling-veo-and-sora-prompting-strategies-92ef0055658b](https://medium.com/@creativeaininja/how-to-actually-control-next-gen-video-ai-runway-kling-veo-and-sora-prompting-strategies-92ef0055658b)  
32. Sora 2 API | OpenAI \- Replicate, accessed December 29, 2025, [https://replicate.com/openai/sora-2](https://replicate.com/openai/sora-2)  
33. How is OpenAI's Sora 2 Model Redefining Generative Video AI? | Technology Magazine, accessed December 29, 2025, [https://technologymagazine.com/news/openais-sora-2-redefining-safe-physics-driven-video-ai](https://technologymagazine.com/news/openais-sora-2-redefining-safe-physics-driven-video-ai)  
34. Sora 2 Prompt Authoring Best Practices (2025): Proven Workflow Guide \- Skywork.ai, accessed December 29, 2025, [https://skywork.ai/blog/sora-2-prompt-authoring-best-practices-2025/](https://skywork.ai/blog/sora-2-prompt-authoring-best-practices-2025/)  
35. Ultimate Sora 2 Prompt Guide: Craft Perfect AI Video Instructions for Cinematic Results, accessed December 29, 2025, [https://www.glbgpt.com/hub/ultimate-sora-2-prompt-guide/](https://www.glbgpt.com/hub/ultimate-sora-2-prompt-guide/)  
36. How to Use Sora AI: A Video Prompting Guide, accessed December 29, 2025, [https://leonardo.ai/news/sora-prompt-guide/](https://leonardo.ai/news/sora-prompt-guide/)  
37. Sora (text-to-video model) \- Wikipedia, accessed December 29, 2025, [https://en.wikipedia.org/wiki/Sora\_(text-to-video\_model)](https://en.wikipedia.org/wiki/Sora_\(text-to-video_model\))  
38. Introducing Structured Outputs in the API \- OpenAI, accessed December 29, 2025, [https://openai.com/index/introducing-structured-outputs-in-the-api/](https://openai.com/index/introducing-structured-outputs-in-the-api/)  
39. Sora 2 Prompting Guide | OpenAI Cookbook, accessed December 29, 2025, [https://cookbook.openai.com/examples/sora/sora2\_prompting\_guide](https://cookbook.openai.com/examples/sora/sora2_prompting_guide)  
40. OpenAI Compatible API | Poe Creator Platform, accessed December 29, 2025, [https://creator.poe.com/docs/external-applications/openai-compatible-api](https://creator.poe.com/docs/external-applications/openai-compatible-api)  
41. OpenAI Sora 2: Redefining the Landscape of AI Video Generation \- DelMorgan & Co., accessed December 29, 2025, [https://delmorganco.com/openai-sora-2/](https://delmorganco.com/openai-sora-2/)  
42. tryonlabs/opentryon: Open-source APIs, SDKs, and models for building virtual try-on and fashion AI applications. Generate models, edit garments, create photoshoots, and build personalized fashion experiences. \- GitHub, accessed December 29, 2025, [https://github.com/tryonlabs/opentryon](https://github.com/tryonlabs/opentryon)  
43. IMPORTANT vs. NOT IMPORTANT: Your 2026 AI Creator Tools List \- AI Did That\!, accessed December 29, 2025, [https://www.aididthat.com/p/the-ai-space-is-moving-too-fast-to-wait](https://www.aididthat.com/p/the-ai-space-is-moving-too-fast-to-wait)  
44. Veo 4: What to Expect from Google's Next AI Model \- Artlist Blog, accessed December 29, 2025, [https://artlist.io/blog/veo-4-coming-soon/](https://artlist.io/blog/veo-4-coming-soon/)  
45. Veo 4 Release \- What's Coming \- VEED.IO, accessed December 29, 2025, [https://www.veed.io/learn/veo-4-release](https://www.veed.io/learn/veo-4-release)  
46. JSON Prompting for AI Video Generation | ImagineArt, accessed December 29, 2025, [https://www.imagine.art/blogs/json-prompting-for-ai-video-generation](https://www.imagine.art/blogs/json-prompting-for-ai-video-generation)  
47. Google Veo 3.1 Overview | ImagineArt, accessed December 29, 2025, [https://www.imagine.art/blogs/google-veo-3-1-overview](https://www.imagine.art/blogs/google-veo-3-1-overview)  
48. Google Veo 4 Explained: The First AI Video Model That's Actually Production-Ready, accessed December 29, 2025, [https://www.youtube.com/watch?v=Gry\_bUa5NNQ](https://www.youtube.com/watch?v=Gry_bUa5NNQ)  
49. 09.19.25 Future Film Fridays \- Taryn O'Neill, accessed December 29, 2025, [https://tarynoneill.medium.com/09-19-25-future-film-fridays-120f9319afa1](https://tarynoneill.medium.com/09-19-25-future-film-fridays-120f9319afa1)  
50. snubroot/Veo-3-Prompting-Guide \- GitHub, accessed December 29, 2025, [https://github.com/snubroot/Veo-3-Prompting-Guide](https://github.com/snubroot/Veo-3-Prompting-Guide)  
51. New Prompt Injection Attack Vectors Through MCP Sampling \- Palo Alto Networks Unit 42, accessed December 29, 2025, [https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/)  
52. Preventing AI Project Failures Through Effective Prompt Engineering \- DEV Community, accessed December 29, 2025, [https://dev.to/kapusto/preventing-ai-project-failures-through-effective-prompt-engineering-13lj](https://dev.to/kapusto/preventing-ai-project-failures-through-effective-prompt-engineering-13lj)