/**
 * QuickQuoteClean OpenAI Prompt Template
 * 
 * This file contains the prompt templates used for generating cleaning quotes.
 * You can modify this file to change how the AI responds to video uploads.
 * 
 * Available variables that will be replaced:
 * - {{CLEANING_CONTEXT}} - The additional context provided by the customer
 * - {{ACTIVITY_COUNTS}} - The adjusted activity counts (for final quote only)
 */

// First step prompt - Identify activities from the video
const getInitialAnalysisTemplate = () => {
  return `You are a professional cleaning service estimator. Based on these images of a space, identify the number of each room type and additional activities that would need cleaning. Follow these guidelines:

1. Start with a brief, tactful summary of the space shown in the video, including its type, size, and condition. Do not use language that could offend the customer about their living arrangements.

2. The customer provided this additional context: {{CLEANING_CONTEXT}}

3. Based on the images and context, identify the number of each of these room types:
   - Bedrooms
   - Bathrooms
   - Living/Dining Rooms
   - Kitchens
   - Study/Utility Rooms
   - Hallways
   - Staircases

4. Also identify if these additional activities would be needed (yes/no):
   - Ironing
   - Folding Laundry
   - Internal Windows Cleaning
   - Inside Fridge Cleaning
   - Washing Dishes/Loading Dishwasher
   - Changing Bed Sheets

5. Return your response in this exact JSON format:
{
  "summary": "Brief summary of the space",
  "rooms": {
    "bedrooms": 2,
    "bathrooms": 1,
    "livingDiningRooms": 1,
    "kitchens": 1,
    "studyUtilityRooms": 0,
    "hallways": 1,
    "staircases": 1
  },
  "activities": {
    "ironing": false,
    "foldingLaundry": false,
    "internalWindows": true,
    "insideFridge": false,
    "washingDishes": true,
    "changingBedSheets": true
  }
}

IMPORTANT: The response must be valid JSON with no additional text before or after. Do not include markdown formatting, explanations, or any other content. Make sure all property names are exactly as shown above, all in camelCase. All room counts must be numbers and all activity values must be true or false booleans.`;
};

// Second step prompt - Generate quote based on adjusted activity counts
const getFinalQuoteTemplate = () => {
  return `You are a professional cleaning service estimator. Create a cleaning quote based on the following information about a space. Follow these guidelines:

1. Start with a brief, tactful summary of the space that will be cleaned.

2. The customer provided this additional context: {{CLEANING_CONTEXT}}

3. The customer has confirmed the following rooms and activities to be included:
{{ACTIVITY_COUNTS}}

4. List each cleaning activity that would be undertaken with a specific time allocation for each task.
Use the following time estimates:
 - Bedroom - 30 mins each
 - Bathroom - 30 mins each
 - Living/Dining Room - 30 mins each
 - Kitchen - 30 mins each
 - Study/Utility Room - 30 mins each
 - Hallway - 15 mins each
 - Staircase - 15 mins each
 - Ironing - 1.5 hours (if applicable)
 - Folding Laundry - 30 mins (if applicable)
 - Internal Windows - 30 mins (if applicable)
 - Inside Fridge - 30 mins (if applicable)
 - Washing Dishes/Loading Dishwasher - 15 mins (if applicable)
 - Changing Bed Sheets - 15 mins per bed (if applicable)

5. End with a total time calculation and the final price quote using a fixed rate of £15 per hour.

IMPORTANT FORMATTING RULES:
- Do NOT include any introduction or sign-off
- Do NOT mention that this was created by AI
- Do NOT use markdown formatting like '#', '*', or '**'
- Use plain text formatting only
- Use simple line breaks and spacing for organization
- Start directly with the space summary
- Use a clean, professional presentation suitable for a customer`;
};

/**
 * Formats the initial analysis prompt with the provided context
 * 
 * @param {string} cleaningContext - The cleaning context provided by the customer
 * @returns {string} The formatted prompt
 */
const formatInitialAnalysisPrompt = (cleaningContext) => {
  const template = getInitialAnalysisTemplate();
  
  // Replace placeholders in the template
  return template
    .replace('{{CLEANING_CONTEXT}}', cleaningContext || "No additional context provided");
};

/**
 * Formats the final quote prompt with the provided context and activity counts
 * 
 * @param {string} cleaningContext - The cleaning context provided by the customer
 * @param {Object} activityCounts - The adjusted activity counts
 * @returns {string} The formatted prompt
 */
const formatFinalQuotePrompt = (cleaningContext, activityCounts) => {
  const template = getFinalQuoteTemplate();
  
  // Format activity counts for the prompt
  let formattedCounts = '';
  
  // Format rooms
  formattedCounts += 'Rooms to clean:\n';
  for (const [room, count] of Object.entries(activityCounts.rooms)) {
    if (count > 0) {
      // Convert camelCase to readable format
      const readableRoom = room
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace('Rooms', 'Room(s)');
      
      formattedCounts += `- ${readableRoom}: ${count}\n`;
    }
  }
  
  // Format activities
  formattedCounts += '\nAdditional activities:\n';
  for (const [activity, included] of Object.entries(activityCounts.activities)) {
    if (included) {
      // Convert camelCase to readable format
      const readableActivity = activity
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
      
      formattedCounts += `- ${readableActivity}: Yes\n`;
    }
  }
  
  // Replace placeholders in the template
  return template
    .replace('{{CLEANING_CONTEXT}}', cleaningContext || "No additional context provided")
    .replace('{{ACTIVITY_COUNTS}}', formattedCounts);
};

module.exports = {
  getInitialAnalysisTemplate,
  getFinalQuoteTemplate,
  formatInitialAnalysisPrompt,
  formatFinalQuotePrompt
};
