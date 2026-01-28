# OpenAI Videos API Reference

Source: `https://platform.openai.com/docs/api-reference/videos`

Generate videos.

---

## Create video

**POST** `https://api.openai.com/v1/videos`

Create a new video generation job from a prompt and optional reference assets.

### Request body

- **prompt** (string, required)  
  Text prompt that describes the video to generate.

- **input_reference** (file, optional)  
  Optional image reference that guides generation.

- **model** (string, optional)  
  The video generation model to use (allowed values: `sora-2`, `sora-2-pro`). Defaults to `sora-2`.

- **seconds** (string, optional)  
  Clip duration in seconds (allowed values: `4`, `8`, `12`). Defaults to `4` seconds.

- **size** (string, optional)  
  Output resolution formatted as `width x height` (allowed values: `720x1280`, `1280x720`, `1024x1792`, `1792x1024`). Defaults to `720x1280`.

### Returns

Returns the newly created video job.

### Example request

```bash
curl https://api.openai.com/v1/videos \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=sora-2" \
  -F "prompt=A calico cat playing a piano on stage"
```

### Example response

```json
{
  "id": "video_123",
  "object": "video",
  "model": "sora-2",
  "status": "queued",
  "progress": 0,
  "created_at": 1712697600,
  "size": "1024x1792",
  "seconds": "8",
  "quality": "standard"
}
```

---

## Remix video

**POST** `https://api.openai.com/v1/videos/{video_id}/remix`

Create a remix of a completed video using a refreshed prompt.

### Path parameters

- **video_id** (string, required)  
  The identifier of the completed video to remix.

### Request body

- **prompt** (string, required)  
  Updated text prompt that directs the remix generation.

### Returns

Creates a remix of the specified video job using the provided prompt.

### Example request

```bash
curl -X POST https://api.openai.com/v1/videos/video_123/remix \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Extend the scene with the cat taking a bow to the cheering audience"
  }'
```

### Example response

```json
{
  "id": "video_456",
  "object": "video",
  "model": "sora-2",
  "status": "queued",
  "progress": 0,
  "created_at": 1712698600,
  "size": "720x1280",
  "seconds": "8",
  "remixed_from_video_id": "video_123"
}
```

---

## List videos

**GET** `https://api.openai.com/v1/videos`

List recently generated videos for the current project.

### Query parameters

- **after** (string, optional)  
  Identifier for the last item from the previous pagination request

- **limit** (integer, optional)  
  Number of items to retrieve

- **order** (string, optional)  
  Sort order of results by timestamp. Use `asc` for ascending order or `desc` for descending order.

### Returns

Returns a paginated list of video jobs for the organization.

### Example request

```bash
curl https://api.openai.com/v1/videos \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Example response

```json
{
  "data": [
    {
      "id": "video_123",
      "object": "video",
      "model": "sora-2",
      "status": "completed"
    }
  ],
  "object": "list"
}
```

---

## Retrieve video

**GET** `https://api.openai.com/v1/videos/{video_id}`

Fetch the latest metadata for a generated video.

### Path parameters

- **video_id** (string, required)  
  The identifier of the video to retrieve.

### Returns

Returns the video job matching the provided identifier.

### Example request

```javascript
import OpenAI from 'openai';

const client = new OpenAI();

const video = await client.videos.retrieve('video_123');

console.log(video.id);
```

---

## Delete video

**DELETE** `https://api.openai.com/v1/videos/{video_id}`

Permanently delete a completed or failed video and its stored assets.

### Path parameters

- **video_id** (string, required)  
  The identifier of the video to delete.

### Returns

Returns the deleted video job metadata.

### Example request

```javascript
import OpenAI from 'openai';

const client = new OpenAI();

const video = await client.videos.delete('video_123');

console.log(video.id);
```

---

## Retrieve video content

**GET** `https://api.openai.com/v1/videos/{video_id}/content`

Download the generated video bytes or a derived preview asset.

### Path parameters

- **video_id** (string, required)  
  The identifier of the video whose media to download.

### Query parameters

- **variant** (string, optional)  
  Which downloadable asset to return. Defaults to the MP4 video.

### Returns

Streams the rendered video content for the specified video job.

### Example request

```javascript
import OpenAI from 'openai';

const client = new OpenAI();

const response = await client.videos.downloadContent('video_123');

console.log(response);

const content = await response.blob();
console.log(content);
```

---

## Video job

Structured information describing a generated video job.

### Properties

- **completed_at** (integer)  
  Unix timestamp (seconds) for when the job completed, if finished.

- **created_at** (integer)  
  Unix timestamp (seconds) for when the job was created.

- **error** (object)  
  Error payload that explains why generation failed, if applicable.

- **expires_at** (integer)  
  Unix timestamp (seconds) for when the downloadable assets expire, if set.

- **id** (string)  
  Unique identifier for the video job.

- **model** (string)  
  The video generation model that produced the job.

- **object** (string)  
  The object type, which is always `video`.

- **progress** (integer)  
  Approximate completion percentage for the generation task.

- **prompt** (string)  
  The prompt that was used to generate the video.

- **remixed_from_video_id** (string)  
  Identifier of the source video if this video is a remix.

- **seconds** (string)  
  Duration of the generated clip in seconds.

- **size** (string)  
  The resolution of the generated video.

- **status** (string)  
  Current lifecycle status of the video job.


