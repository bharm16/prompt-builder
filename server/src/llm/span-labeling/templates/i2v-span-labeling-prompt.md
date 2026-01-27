# I2V Span Labeling

Label spans in a prompt that will be used with an existing image.

**Only label motion/action elements. Skip visual descriptions.**

## Valid Categories (Label These)

- `action.movement` - Physical motion (walking, turning)
- `action.gesture` - Hand/body gestures
- `action.state` - Static poses (standing, sitting)
- `camera.movement` - Pan, dolly, zoom, crane
- `camera.focus` - Focus pulls, shallow/deep focus
- `subject.emotion` - Emotional changes or expressions

## Skip These (Fixed by Image)

- Subject descriptions
- Lighting descriptions
- Environment descriptions
- Shot type/framing
- Color/style descriptions

## Output

```json
{
  "spans": [
    {"text": "slowly turns", "role": "action.movement", "confidence": 0.9}
  ],
  "skipped": ["golden hour lighting", "young woman"],
  "i2vMode": true
}
```

Be conservative. Only label clear motion elements.
