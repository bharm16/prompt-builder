import { describe, it, expect, vi } from 'vitest';
import { detectAndApplySceneChange } from '../../../../client/src/utils/detectSceneChange.js';

describe('detectAndApplySceneChange', () => {
  const basePrompt = `\n**WHERE - LOCATION/SETTING**\n- Environment Type: [Forest]\n- Architectural Details: [Wooden cabins]\n- Environmental Scale: [Intimate]\n- Atmospheric Conditions: [Misty]\n- Background Elements: [Tall pines]\n- Foreground Elements: [Mossy rocks]\n- Spatial Depth: [Layered]\n- Environmental Storytelling: [Tranquil retreat]\n\n**WHEN - TIME/ERA**\n- Time of Day: [Dawn]\n`;

  it('returns updated prompt when WHERE section is missing', async () => {
    const fetchMock = vi.fn();
    const confirmMock = vi.fn();

    const result = await detectAndApplySceneChange({
      originalPrompt: 'No structured data here',
      updatedPrompt: 'No structured data here',
      oldValue: 'Forest',
      newValue: 'Desert',
      fetchImpl: fetchMock,
      confirmSceneChange: confirmMock,
    });

    expect(result).toBe('No structured data here');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('skips scene change updates when API reports no change', async () => {
    const updatedPrompt = basePrompt.replace(
      '- Environment Type: [Forest]',
      '- Environment Type: [Desert]'
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          isSceneChange: false,
          confidence: 'high',
        }),
    });
    const confirmMock = vi.fn();

    const result = await detectAndApplySceneChange({
      originalPrompt: basePrompt,
      updatedPrompt,
      oldValue: 'Forest',
      newValue: 'Desert',
      fetchImpl: fetchMock,
      confirmSceneChange: confirmMock,
    });

    expect(result).toBe(updatedPrompt);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).not.toHaveBeenCalled();

    const [, fetchOptions] = fetchMock.mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body).toMatchObject({
      changedField: 'Environment Type',
      oldValue: 'Forest',
      newValue: 'Desert',
      affectedFields: {
        'Architectural Details': 'Wooden cabins',
        'Environmental Scale': 'Intimate',
        'Atmospheric Conditions': 'Misty',
        'Background Elements': 'Tall pines',
        'Foreground Elements': 'Mossy rocks',
        'Spatial Depth': 'Layered',
        'Environmental Storytelling': 'Tranquil retreat',
      },
    });
  });

  it('applies suggested updates when scene change is confirmed', async () => {
    const updatedPrompt = basePrompt.replace(
      '- Environment Type: [Forest]',
      '- Environment Type: [Desert Oasis]'
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          isSceneChange: true,
          confidence: 'high',
          reasoning: 'A radically different biome.',
          suggestedUpdates: {
            'Architectural Details': 'Adobe dwellings',
            'Atmospheric Conditions': 'Dry heat',
          },
        }),
    });
    const confirmMock = vi.fn().mockReturnValue(true);

    const result = await detectAndApplySceneChange({
      originalPrompt: basePrompt,
      updatedPrompt,
      oldValue: 'Forest',
      newValue: 'Desert Oasis',
      fetchImpl: fetchMock,
      confirmSceneChange: confirmMock,
    });

    expect(confirmMock).toHaveBeenCalledTimes(1);
    const confirmationMessage = confirmMock.mock.calls[0][0];
    expect(confirmationMessage).toContain('Desert Oasis');
    expect(result).toContain('- Architectural Details: [Adobe dwellings]');
    expect(result).toContain('- Atmospheric Conditions: [Dry heat]');
    expect(result).toContain('- Environment Type: [Desert Oasis]');
  });

  it('does not update fields when confirmation is declined', async () => {
    const updatedPrompt = basePrompt.replace(
      '- Environment Type: [Forest]',
      '- Environment Type: [Underwater City]'
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          isSceneChange: true,
          confidence: 'medium',
          reasoning: 'Submerged settings have different requirements.',
          suggestedUpdates: {
            'Architectural Details': 'Coral structures',
          },
        }),
    });
    const confirmMock = vi.fn().mockReturnValue(false);

    const result = await detectAndApplySceneChange({
      originalPrompt: basePrompt,
      updatedPrompt,
      oldValue: 'Forest',
      newValue: 'Underwater City',
      fetchImpl: fetchMock,
      confirmSceneChange: confirmMock,
    });

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(updatedPrompt);
  });

  it('returns baseline prompt when the API request fails', async () => {
    const updatedPrompt = basePrompt.replace(
      '- Environment Type: [Forest]',
      '- Environment Type: [Ice Caves]'
    );
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    const confirmMock = vi.fn();

    const result = await detectAndApplySceneChange({
      originalPrompt: basePrompt,
      updatedPrompt,
      oldValue: 'Forest',
      newValue: 'Ice Caves',
      fetchImpl: fetchMock,
      confirmSceneChange: confirmMock,
    });

    expect(result).toBe(updatedPrompt);
    expect(confirmMock).not.toHaveBeenCalled();
  });
});
