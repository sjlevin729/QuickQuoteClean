/**
 * QuickQuoteClean OpenAI Prompt Template
 * 
 * This file contains the prompt template used for generating cleaning quotes.
 * You can modify this file to change how the AI responds to video uploads.
 * 
 * Available variables that will be replaced:
 * - {{CLEANING_CONTEXT}} - The additional context provided by the customer
 * - {{INCLUDED_SERVICES}} - List of services the customer has selected
 * - {{EXCLUDED_SERVICES}} - List of services the customer has not selected
 */

const getPromptTemplate = () => {
  return `You are a professional cleaning service estimator. Create a cleaning quote based on these images that will be shown directly to the customer. Follow these guidelines:

1. Start with a brief, tactful summary of the space shown in the video, including its type, size, and condition. Do not use language that could offend the customer about their living arrangements.

2. The customer provided this additional context: {{CLEANING_CONTEXT}}

3. The customer has specifically requested the following services:
{{INCLUDED_SERVICES}}

{{EXCLUDED_SERVICES_SECTION}}

5. List each cleaning activity that would be undertaken with a specific time allocation for each task. ONLY include the services that the customer has requested.

6. End with a total time calculation and the final price quote using a fixed rate of £15 per hour.

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
 * Service descriptions mapping
 * This maps the service IDs to human-readable descriptions
 */
const serviceDescriptions = {
  generalCleaning: "General Cleaning (dusting surfaces, removing cobwebs, cleaning light fixtures)",
  deepCleaning: "Deep Cleaning (detailed cleaning of all surfaces, baseboards, crown molding)",
  kitchenBathroom: "Kitchen & Bathroom Cleaning (countertops, sinks, appliances, toilets, showers)",
  floorCleaning: "Floor Cleaning (vacuuming, mopping, spot cleaning)",
  windowsCleaning: "Windows Cleaning (interior windows, glass surfaces, mirrors)",
  organizingDecluttering: "Organizing & Decluttering (arranging items, removing clutter)"
};

/**
 * Formats the prompt with the provided context and services
 * 
 * @param {string} cleaningContext - The cleaning context provided by the customer
 * @param {Object} selectedServices - Object with service IDs as keys and boolean values
 * @returns {string} The formatted prompt
 */
const formatPrompt = (cleaningContext, selectedServices) => {
  const template = getPromptTemplate();
  
  // Format included services
  const includedServices = Object.entries(selectedServices)
    .filter(([_, selected]) => selected)
    .map(([service]) => {
      return `   - ${serviceDescriptions[service] || service
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())}`;
    });
  
  const includedServicesText = includedServices.length > 0 
    ? includedServices.join('\n') 
    : "   - General cleaning services";
  
  // Format excluded services
  const excludedServices = Object.entries(selectedServices)
    .filter(([_, selected]) => !selected)
    .map(([service]) => {
      return `   - ${serviceDescriptions[service] || service
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())}`;
    });
  
  const excludedServicesSection = excludedServices.length > 0
    ? `4. The customer has specifically excluded these services (DO NOT include these in the quote):\n${excludedServices.join('\n')}\n`
    : '';
  
  // Replace placeholders in the template
  return template
    .replace('{{CLEANING_CONTEXT}}', cleaningContext || "No additional context provided")
    .replace('{{INCLUDED_SERVICES}}', includedServicesText)
    .replace('{{EXCLUDED_SERVICES_SECTION}}', excludedServicesSection);
};

module.exports = {
  getPromptTemplate,
  formatPrompt,
  serviceDescriptions
};
