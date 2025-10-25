import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Camera, Lightbulb, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

/**
 * StepTechnical Component - Desktop Step 3
 *
 * Advanced technical parameters with collapsible categories:
 * - Camera (angle, distance, movement, lens, focus)
 * - Lighting (quality, direction, color, intensity)
 * - Composition (framing, aspect ratio)
 * - Motion (speed, smoothness)
 * - Effects (post-production)
 *
 * All parameters are optional
 * Collapsible categories (collapsed by default)
 * Preset buttons for common configurations
 */
const StepTechnical = ({
  formData,
  onChange,
  onNext,
  onBack
}) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedPreset, setSelectedPreset] = useState(null);

  // Technical categories configuration
  const categories = [
    {
      id: 'camera',
      name: 'Camera Settings',
      icon: '📷',
      description: 'Camera angles, movements, and lens choices',
      fields: [
        { name: 'angle', label: 'Camera Angle', placeholder: 'e.g., eye-level, low angle, bird\'s eye view' },
        { name: 'distance', label: 'Camera Distance', placeholder: 'e.g., close-up, medium shot, wide shot' },
        { name: 'movement', label: 'Camera Movement', placeholder: 'e.g., static, tracking, dolly zoom' },
        { name: 'lens', label: 'Lens Type', placeholder: 'e.g., 50mm, wide-angle, telephoto' },
        { name: 'focusType', label: 'Focus', placeholder: 'e.g., shallow depth of field, deep focus' }
      ]
    },
    {
      id: 'lighting',
      name: 'Lighting',
      icon: '💡',
      description: 'Light quality, direction, and color',
      fields: [
        { name: 'quality', label: 'Light Quality', placeholder: 'e.g., soft, hard, diffused' },
        { name: 'direction', label: 'Light Direction', placeholder: 'e.g., front-lit, backlit, side-lit' },
        { name: 'color', label: 'Light Color', placeholder: 'e.g., warm, cool, natural' },
        { name: 'intensity', label: 'Intensity', placeholder: 'e.g., bright, dim, dramatic' }
      ]
    },
    {
      id: 'composition',
      name: 'Composition',
      icon: '🎬',
      description: 'Framing and visual structure',
      fields: [
        { name: 'framing', label: 'Framing', placeholder: 'e.g., rule of thirds, centered, symmetrical' },
        { name: 'aspectRatio', label: 'Aspect Ratio', placeholder: 'e.g., 16:9, 9:16, cinematic 2.39:1' }
      ]
    },
    {
      id: 'motion',
      name: 'Motion & Pace',
      icon: '⚡',
      description: 'Speed and smoothness of movement',
      fields: [
        { name: 'speed', label: 'Motion Speed', placeholder: 'e.g., slow motion, normal speed, time-lapse' },
        { name: 'smoothness', label: 'Smoothness', placeholder: 'e.g., smooth, handheld, steady' }
      ]
    },
    {
      id: 'effects',
      name: 'Effects & Style',
      icon: '✨',
      description: 'Post-production and visual effects',
      fields: [
        { name: 'colorGrading', label: 'Color Grading', placeholder: 'e.g., vibrant, desaturated, vintage' },
        { name: 'visualEffects', label: 'Visual Effects', placeholder: 'e.g., lens flare, particles, bloom' }
      ]
    }
  ];

  // Preset configurations
  const presets = [
    {
      id: 'cinematic',
      name: 'Cinematic',
      description: 'Film-like quality with dramatic lighting',
      values: {
        camera: { angle: 'eye-level', distance: 'medium shot', lens: '35mm' },
        lighting: { quality: 'soft', direction: 'side-lit', color: 'warm' },
        composition: { aspectRatio: 'cinematic 2.39:1' }
      }
    },
    {
      id: 'documentary',
      name: 'Documentary',
      description: 'Natural and realistic approach',
      values: {
        camera: { movement: 'handheld', distance: 'medium shot' },
        lighting: { quality: 'natural', color: 'neutral' },
        motion: { smoothness: 'handheld' }
      }
    },
    {
      id: 'commercial',
      name: 'Commercial',
      description: 'Polished and vibrant',
      values: {
        camera: { movement: 'smooth tracking', lens: '50mm' },
        lighting: { quality: 'soft', intensity: 'bright' },
        effects: { colorGrading: 'vibrant and saturated' }
      }
    },
    {
      id: 'music-video',
      name: 'Music Video',
      description: 'Dynamic and creative',
      values: {
        camera: { movement: 'dynamic tracking', angle: 'varied angles' },
        lighting: { color: 'colorful', intensity: 'dramatic' },
        motion: { speed: 'varied pace' }
      }
    }
  ];

  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Apply preset
  const applyPreset = (preset) => {
    setSelectedPreset(preset.id);
    // Apply all preset values
    Object.entries(preset.values).forEach(([categoryId, fields]) => {
      Object.entries(fields).forEach(([fieldName, value]) => {
        onChange(`${categoryId}.${fieldName}`, value);
      });
    });
    // Expand categories that have values
    const newExpanded = {};
    Object.keys(preset.values).forEach(categoryId => {
      newExpanded[categoryId] = true;
    });
    setExpandedCategories(newExpanded);
  };

  // Handle field change
  const handleFieldChange = (categoryId, fieldName, value) => {
    onChange(`${categoryId}.${fieldName}`, value);
    setSelectedPreset(null); // Clear preset selection when manually changing
  };

  // Count filled fields in a category
  const getFilledFieldsCount = (category) => {
    const categoryData = formData[category.id] || {};
    return category.fields.filter(field => categoryData[field.name]).length;
  };

  // Calculate total filled technical parameters
  const getTotalFilledParams = () => {
    let count = 0;
    categories.forEach(category => {
      count += getFilledFieldsCount(category);
    });
    return count;
  };

  const totalParams = getTotalFilledParams();

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Step Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Camera className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Technical Parameters</h2>
        </div>
        <p className="text-gray-600 text-lg">
          Fine-tune camera, lighting, and effects. All parameters are optional.
        </p>
        {totalParams > 0 && (
          <p className="mt-2 text-sm text-green-600 flex items-center">
            <CheckCircle className="w-4 h-4 mr-1" />
            {totalParams} parameter{totalParams !== 1 ? 's' : ''} configured
          </p>
        )}
      </div>

      {/* Preset Buttons */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Presets</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={`
                p-3 rounded-lg border-2 text-left transition-all duration-200
                ${selectedPreset === preset.id
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow'
                }
              `}
            >
              <p className="font-semibold text-sm text-gray-900">{preset.name}</p>
              <p className="text-xs text-gray-600 mt-1">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Technical Categories */}
      <div className="space-y-4">
        {categories.map((category) => {
          const isExpanded = expandedCategories[category.id];
          const filledCount = getFilledFieldsCount(category);
          const categoryData = formData[category.id] || {};

          return (
            <div
              key={category.id}
              className="border-2 border-gray-200 rounded-lg overflow-hidden transition-all duration-200 hover:border-gray-300"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full px-5 py-4 bg-white hover:bg-gray-50 transition-colors duration-150 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{category.icon}</span>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{category.name}</h3>
                    <p className="text-xs text-gray-600">{category.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {filledCount > 0 && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {filledCount} set
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Category Fields */}
              {isExpanded && (
                <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 space-y-4">
                  {category.fields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={categoryData[field.name] || ''}
                        onChange={(e) => handleFieldChange(category.id, field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="mt-10 flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200"
        >
          Back to Atmosphere
        </button>

        <div className="flex space-x-3">
          <button
            onClick={onNext}
            className="px-6 py-3 rounded-lg font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all duration-200"
          >
            Skip Technical
          </button>
          <button
            onClick={onNext}
            className="px-8 py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200"
          >
            Review & Generate
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex items-start space-x-2">
          <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-900">
              <strong>Advanced users only:</strong> Technical parameters give you fine-grained control but are completely optional.
              Most users can skip this step and still get great results!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

StepTechnical.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired
};

export default StepTechnical;
