import { TAG_CATEGORIES } from "@/lib/news/tag-categories";
import { makeGeminiCall } from "@/lib/news/gemini";
import pRetry from "p-retry";

export async function generateNewsletterTitle(articles: { title: string; description?: string; source?: string }[]): Promise<string> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn("GEMINI_API_KEY not set, using default title");
    return "CRE News";
  }

  try {
    console.log(`Generating newsletter title for ${articles.length} articles...`);

    // Take top 3-4 articles for headline generation
    const topArticles = articles.slice(0, 4);

    const prompt = `You are a newsletter editor for commercial real estate news. Based on the following top articles, create a newsletter subject line in the style of TLDR or similar news aggregators.

The format should be a comma-separated list of 3-4 concise headlines, each highlighting a key story. Keep each headline short (5-8 words max), engaging, and professional.

Articles:
${topArticles.map((article, index) => `${index + 1}. ${article.title}${article.description ? ` - ${article.description.substring(0, 100)}...` : ''}`).join('\n')}

Examples of good formats:
- "San Jose Tower Secures Funding, Fight For Affordable Housing, New Presidio Apartments"
- "Palo Alto Office Market Rebounds, Peninsula Development Surge, Bay Area Rental Trends"
- "SF Real Estate Recovery, Silicon Valley Investment Boom, Affordable Housing Push"

Generate a subject line that:
- Combines 3-4 headlines separated by commas
- Each headline is concise (5-8 words)
- Highlights the most important/interesting stories
- Sounds professional and engaging
- Focuses on location, property type, or key events

Return ONLY the subject line, no quotes or extra text.`;

    const result = await pRetry(
      () => makeGeminiCall("gemini-2.5-flash-lite", prompt, {
        operation: "generate-newsletter-title",
        maxTokens: 120,
        temperature: 0.7
      }),
      { retries: 2 }
    );

    const title = result.candidates[0].content.parts[0].text.trim();

    console.log(`Generated title: "${title}"`);
    return title || "CRE News";

  } catch (error) {
    console.error('Error generating newsletter title:', error);
    return "CRE News";
  }
}

export async function generateArticleTitles(articles: { title: string; description?: string }[]): Promise<{ titles: string[], descriptions: string[] }> {
  if (articles.length === 0) return { titles: [], descriptions: [] };

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn("GEMINI_API_KEY not set, skipping title/description generation");
    return {
      titles: articles.map(article => article.title),
      descriptions: articles.map(article => article.description || '')
    };
  }

  try {
    // Generate titles first
    console.log(`Generating titles for ${articles.length} articles...`);
    const titlesPrompt = `You are a real estate news editor. For each LinkedIn post, generate a clear, engaging title.

LinkedIn Posts:
${articles.map((article, index) => `${index}. Content: ${article.description || 'No content'}`).join('\n\n')}

Return a JSON object with a "titles" array.

Titles should be:
- Clear and concise (under 80 characters)
- Professional and engaging
- Focused on the key real estate insight or news
- Avoid clickbait or excessive punctuation

Example: {
  "titles": ["San Francisco Office Market Shows Signs of Recovery", "Multifamily Development Surges in Peninsula"]
}`;

    const titlesResult = await pRetry(
      () => makeGeminiCall("gemini-2.5-flash-lite", titlesPrompt, {
        operation: "generate-article-titles",
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            titles: {
              type: "ARRAY",
              items: { type: "STRING" }
            }
          },
          required: ["titles"]
        }
      }),
      { retries: 2 }
    );

    const titlesData = JSON.parse(titlesResult.candidates[0].content.parts[0].text);


    // Generate descriptions separately
    console.log(`Generating descriptions for ${articles.length} articles...`);

    const descriptionsPrompt = `You are a real estate news editor. For each LinkedIn post, generate a concise description.

LinkedIn Posts:
${articles.map((article, index) => `${index}. Content: ${article.description || 'No content'}`).join('\n\n')}

Return a JSON object with a "descriptions" array.

Descriptions should be:
- 1-2 sentences summarizing the key points
- Professional and informative
- Under 200 characters
- Focus on the main real estate insight or impact

Example: {
  "descriptions": ["New leasing activity and tenant demand indicate a potential turnaround in the city's struggling office sector.", "Several major multifamily projects are breaking ground across the Peninsula, driven by strong rental demand."]
}`;

    const descriptionsResult = await pRetry(
      () => makeGeminiCall("gemini-2.5-flash-lite", descriptionsPrompt, {
        operation: "generate-article-descriptions",
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            descriptions: {
              type: "ARRAY",
              items: { type: "STRING" }
            }
          },
          required: ["descriptions"]
        }
      }),
      { retries: 2 }
    );

    const descriptionsData = JSON.parse(descriptionsResult.candidates[0].content.parts[0].text);


    return {
      titles: titlesData.titles || articles.map(article => article.title),
      descriptions: descriptionsData.descriptions || articles.map(article => article.description || '')
    };
  } catch (error) {
    console.error("Error in title/description generation:", error);
    return {
      titles: articles.map(article => article.title),
      descriptions: articles.map(article => article.description || '')
    };
  }
}

export async function checkArticleRelevance(articles: { title: string; description?: string }[]): Promise<boolean[]> {
  if (articles.length === 0) return [];

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn("GEMINI_API_KEY not set, assuming all articles are relevant");
    return articles.map(() => true);
  }

  try {
    const prompt = `You are a content filter for a mid-market real estate news aggregator. This platform focuses on:
- Commercial real estate (office, retail, industrial, hospitality)
- Multifamily residential properties (apartments, condos, townhomes)
- Real estate development, construction, and zoning
- Property investment, acquisitions, sales, and financing
- Real estate market trends, analysis, and data
- Government policy and regulations affecting real estate
- Infrastructure projects affecting property values

EXCLUDE articles about:
- General news or content unrelated to real estate

For each article below, determine if it's relevant to commercial/mid-market real estate.

CRITICAL: You must return EXACTLY ${articles.length} boolean values in a JSON array, one for each article in order (true = relevant, false = not relevant).

Articles:
${articles.map((article, index) => `${index}. Title: ${article.title}\n   Description: ${article.description || 'No description'}`).join('\n\n')}

Return a JSON array of exactly ${articles.length} booleans, e.g. [true, false, true, true, ...] with exactly ${articles.length} elements.`;

    const result = await pRetry(
      () => makeGeminiCall("gemini-3-flash-preview", prompt, {
        operation: "check-article-relevance",
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "BOOLEAN"
          }
        }
      }),
      { retries: 2 }
    );

    const responseText = result.candidates[0]?.content?.parts[0]?.text || '';

    if (!responseText) {
      console.warn("Empty response from Gemini, assuming all relevant");
      return articles.map(() => true);
    }

    let relevance: boolean[];
    try {
      relevance = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse relevance response:", responseText.substring(0, 200));
      console.error("Parse error:", parseError);
      return articles.map(() => true);
    }

    // Handle case where response might be wrapped in an object
    if (!Array.isArray(relevance)) {
      if (typeof relevance === 'object' && relevance !== null) {
        const arrayValue = Object.values(relevance).find(v => Array.isArray(v));
        if (arrayValue) {
          relevance = arrayValue as boolean[];
        } else {
          console.warn("Response is not an array:", typeof relevance, Object.keys(relevance || {}));
          return articles.map(() => true);
        }
      } else {
        console.warn("Response is not an array:", typeof relevance);
        return articles.map(() => true);
      }
    }

    // Ensure all values are booleans
    relevance = relevance.map(v => Boolean(v));

    // Ensure we return the correct number of results
    if (relevance.length === articles.length) {
      return relevance;
    }

    // Handle length mismatch
    if (relevance.length < articles.length) {
      console.warn(`Relevance check returned ${relevance.length} results for ${articles.length} articles, padding with 'true'`);
      while (relevance.length < articles.length) {
        relevance.push(true);
      }
      return relevance;
    } else {
      console.warn(`Relevance check returned ${relevance.length} results for ${articles.length} articles, truncating`);
      return relevance.slice(0, articles.length);
    }
  } catch (error) {
    console.error("Error in article relevance check:", error);
    return articles.map(() => true);
  }
}

// Helper function to validate county categories and identify invalid ones
function validateCountyCategories(
    categories: string[][],
    articles: { title: string; description?: string }[],
    validCounties: Set<string>
): {
    validatedCategories: string[][];
    articlesWithInvalidCounties: Array<{ index: number; article: typeof articles[0]; invalidCounties: string[] }>;
} {
    const articlesWithInvalidCounties: Array<{ index: number; article: typeof articles[0]; invalidCounties: string[] }> = [];
    const validatedCategories = categories.map((cats: string[], index: number) => {
        const validCats = cats.filter(cat => validCounties.has(cat));
        const invalidCats = cats.filter(cat => !validCounties.has(cat));

        if (invalidCats.length > 0) {
            articlesWithInvalidCounties.push({
                index,
                article: articles[index],
                invalidCounties: invalidCats
            });
        }

        return validCats.length > 0 ? validCats : ['Other'];
    });

    return { validatedCategories, articlesWithInvalidCounties };
}

// Helper function to retry county categorization for articles with invalid counties
async function retryCountyCategorization(
    articles: { title: string; description?: string }[],
    invalidCountyNames: string[],
    validCounties: Set<string>,
    validCountiesList: string
): Promise<string[][]> {
    const retryPrompt = `You are a real estate news categorizer. For each article below, determine which US counties it relates to.

Available counties (you MUST use exact names from this list): ${validCountiesList}

IMPORTANT: The previous attempt returned invalid county names: ${invalidCountyNames.join(', ')}. These are NOT valid. You must map these to the correct county names from the available list above.

Articles:
${articles.map((article, index) => `${index}. Title: ${article.title}\n   Description: ${article.description || 'No description'}`).join('\n\n')}

Return a JSON array where each element is an array of county names for the corresponding article. Use "Other" for articles not specific to any particular county.

CRITICAL: Only return county names that exactly match the available counties list. If unsure, use "Other".

Example: [["Los Angeles"], ["Other"], ["San Francisco", "Alameda"]]`;

    try {
        const retryResult = await pRetry(
          () => makeGeminiCall("gemini-2.5-flash-lite", retryPrompt, {
            operation: "categorize-counties-retry",
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "ARRAY",
                items: {
                  type: "STRING"
                }
              }
            }
          }),
          { retries: 2 }
        );

        if (!retryResult?.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error("Invalid response structure from Gemini retry:", JSON.stringify(retryResult, null, 2));
            throw new Error("Invalid response from Gemini API: missing candidates[0].content.parts[0].text");
        }

        const retryCategories = JSON.parse(retryResult.candidates[0].content.parts[0].text);

        // Validate retry results and return only valid counties
        const { validatedCategories } = validateCountyCategories(
            retryCategories,
            articles,
            validCounties
        );

        return validatedCategories;
    } catch (retryError) {
        console.error("Error in county categorization retry:", retryError);
        throw retryError;
    }
}

export async function getCountyCategories(articles: { title: string; description?: string; currentCounties?: string[]; reason?: string }[]): Promise<string[][]> {
    if (articles.length === 0) return [];

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.warn("GEMINI_API_KEY not set, skipping county categorization");
        return articles.map(() => ['Other']);
    }

    // Valid counties list
    const validCounties = new Set([
        'Adams', 'Alameda', 'Alexandria', 'Allegan', 'Allegheny', 'Amelia', 'Anne Arundel', 'Anoka', 'Arapahoe', 'Arlington', 'Armstrong', 'Baker', 'Baltimore', 'Baltimore City', 'Barry', 'Bastrop', 'Beaver', 'Bexar', 'Blount', 'Bond', 'Boone', 'Brazoria', 'Brevard', 'Bronx', 'Broomfield', 'Broward', 'Brown', 'Bucks', 'Bullitt', 'Burlington', 'Butler', 'Cabarrus', 'Caldwell', 'Calhoun', 'Camden', 'Campbell', 'Canadian', 'Cannon', 'Carroll', 'Carver', 'Cass', 'Charles', 'Charles City', 'Chatham', 'Cheatham', 'Cherokee', 'Chesapeake', 'Chester', 'Chesterfield', 'Chilton', 'Chisago', 'Clackamas', 'Clark', 'Clay', 'Clayton', 'Clermont', 'Cleveland', 'Clinton', 'Cobb', 'Collin', 'Columbia', 'Comal', 'Contra Costa', 'Cook', 'Crittenden', 'Cumberland', 'Currituck', 'Cuyahoga', 'Dakota', 'Dallas', 'Davidson', 'Davis', 'DeKalb', 'DeSoto', 'Dearborn', 'Delaware', 'Denton', 'Denver', 'Dickson', 'District of Columbia', 'Dodge', 'Douglas', 'DuPage', 'Durham', 'Duval', 'El Dorado', 'Ellis', 'Erie', 'Essex', 'Fairfax', 'Fairfield', 'Falls Church', 'Fayette', 'Floyd', 'Forsyth', 'Fort Bend', 'Franklin', 'Frederick', 'Fulton', 'Galveston', 'Gaston', 'Gates', 'Geauga', 'Genesee', 'Gloucester', 'Goochland', 'Granville', 'Guadalupe', 'Gwinnett', 'Hamilton', 'Hampton', 'Hancock', 'Hanover', 'Harford', 'Harris', 'Harrison', 'Hartford', 'Hays', 'Hendricks', 'Hennepin', 'Henrico', 'Henry', 'Hernando', 'Hillsborough', 'Howard', 'Ionia', 'Iredell', 'Isanti', 'Isle of Wight', 'Jackson', 'Jefferson', 'Jersey', 'Johnson', 'Johnston', 'Kane', 'Kaufman', 'Kent', 'Kenton', 'King', 'Kings', 'Lafayette', 'Lake', 'Lancaster', 'Lapeer', 'Leavenworth', 'Liberty', 'Licking', 'Lincoln', 'Livingston', 'Logan', 'Lorain', 'Los Angeles', 'Loudoun', 'Macomb', 'Macon', 'Macoupin', 'Madison', 'Manassas', 'Manassas Park', 'Maricopa', 'Marin', 'Marion', 'Marshall', 'McClain', 'McHenry', 'Mecklenburg', 'Medina', 'Miami', 'Miami-Dade', 'Middlesex', 'Milwaukee', 'Monroe', 'Montcalm', 'Montgomery', 'Morgan', 'Multnomah', 'Napa', 'Nassau', 'Nelson', 'New Kent', 'New York', 'Newport News', 'Niagara', 'Norfolk', 'Nye', 'Oakland', 'Oklahoma', 'Oldham', 'Orange', 'Orleans', 'Osceola', 'Ottawa', 'Ozaukee', 'Palm Beach', 'Parker', 'Pasco', 'Philadelphia', 'Pickaway', 'Pierce', 'Pinal', 'Pinellas', 'Placer', 'Plaquemines', 'Platte', 'Plymouth', 'Polk', 'Portsmouth', 'Pottawatomie', 'Powhatan', 'Prince George\'s', 'Prince William', 'Queen Anne\'s', 'Queens', 'Racine', 'Ramsey', 'Ray', 'Richmond', 'Riverside', 'Robertson', 'Rockland', 'Rockwall', 'Rowan', 'Rutherford', 'Sacramento', 'Salt Lake', 'San Bernardino', 'San Diego', 'San Francisco', 'San Mateo', 'Santa Clara', 'Scott', 'Seminole', 'Shelby', 'Sherburne', 'Skamania', 'Smith', 'Snohomish', 'Solano', 'Sonoma', 'Southampton', 'Spencer', 'St. Bernard', 'St. Charles', 'St. Clair', 'St. Croix', 'St. John the Baptist', 'St. Johns', 'St. Louis', 'St. Louis City', 'St. Tammany', 'Stafford', 'Stanly', 'Suffolk', 'Summit', 'Sumner', 'Sutter', 'Tarrant', 'Tate', 'Tipton', 'Tolland', 'Tooele', 'Travis', 'Trimble', 'Trousdale', 'Tunica', 'Union', 'Vance', 'Ventura', 'Virginia Beach', 'Volusia', 'Wake', 'Walker', 'Waller', 'Walworth', 'Warren', 'Washington', 'Waukesha', 'Wayne', 'Weber', 'Westchester', 'Westmoreland', 'Will', 'Williamson', 'Wilson', 'Wise', 'Wright', 'Wyandotte', 'Wyoming', 'Yamhill', 'Yolo', 'York', 'Yuba', 'Other'
    ]);

    const validCountiesList = Array.from(validCounties).join(', ');

    try {
        const prompt = `You are a real estate news categorizer. For each article, determine which US counties it relates to.

Available counties: ${validCountiesList}

For each article you will see:
- Title and description
- Previous county categorization (if any)
- A validator reason explaining why the previous categorization might be incorrect (if available)

You MUST use this context to improve the county categorization.

Articles:
${articles.map((article, index) => {
    const previousCounties = Array.isArray(article.currentCounties) && article.currentCounties.length > 0
        ? article.currentCounties.join(', ')
        : 'None';
    const reason = article.reason || 'None';
    return `${index}. Title: ${article.title}
   Description: ${article.description || 'No description'}
   Previous Counties: ${previousCounties}
   Validator Reason: ${reason}`;
}).join('\n\n')}

Return a JSON array where each element is an array of county names for the corresponding article. Use "Other" for articles not specific to any particular county.

Example: [["Los Angeles"], ["Other"], ["San Francisco", "Alameda"]]`;

        const result = await pRetry(
          () => makeGeminiCall("gemini-3-flash-preview", prompt, {
            operation: "categorize-counties",
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "ARRAY",
                items: {
                  type: "STRING"
                }
              }
            }
          }),
          { retries: 2 }
        );

        if (!result?.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error("Invalid response structure from Gemini:", JSON.stringify(result, null, 2));
            throw new Error("Invalid response from Gemini API: missing candidates[0].content.parts[0].text");
        }

        const categories = JSON.parse(result.candidates[0].content.parts[0].text);

        // Validate and identify articles with invalid counties
        const { validatedCategories, articlesWithInvalidCounties } = validateCountyCategories(
            categories,
            articles,
            validCounties
        );

        // If there are articles with invalid counties, retry with just those articles
        if (articlesWithInvalidCounties.length > 0) {
            console.log(`Found ${articlesWithInvalidCounties.length} articles with invalid counties, retrying with focused prompt...`);

            const retryArticles = articlesWithInvalidCounties.map(item => item.article);
            const invalidCountyNames = Array.from(new Set(
                articlesWithInvalidCounties.flatMap(item => item.invalidCounties)
            ));

            const retryCategories = await retryCountyCategorization(
                retryArticles,
                invalidCountyNames,
                validCounties,
                validCountiesList
            );

            // Replace invalid categories with retry results
            articlesWithInvalidCounties.forEach((item, retryIndex) => {
                validatedCategories[item.index] = retryCategories[retryIndex] || ['Other'];
            });

            console.log(`Retry completed, updated ${articlesWithInvalidCounties.length} articles`);
        }

        return validatedCategories;
    } catch (error) {
        console.error("Error in county categorization:", error);
        throw error;
    }
}

export async function getCityCategories(articles: { title: string; description?: string; currentCities?: string[]; currentCounties?: string[]; reason?: string }[]): Promise<string[][]> {
    if (articles.length === 0) return [];

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.warn("GEMINI_API_KEY not set, skipping city categorization");
        return articles.map(() => []);
    }

    try {
        const prompt = `You are a real estate news categorizer. For each article, identify specific US cities mentioned.

For each article you will see:
- Title and description
- Previous city categorization (if any)
- Previous county categorization (if any)
- A validator reason explaining why the previous categorization might be incorrect (if available)

You MUST use this context to improve the city categorization.

Articles:
${articles.map((article, index) => {
    const previousCities = Array.isArray(article.currentCities) && article.currentCities.length > 0
        ? article.currentCities.join(', ')
        : 'None';
    const previousCounties = Array.isArray(article.currentCounties) && article.currentCounties.length > 0
        ? article.currentCounties.join(', ')
        : 'None';
    const reason = article.reason || 'None';
    return `${index}. Title: ${article.title}
   Description: ${article.description || 'No description'}
   Previous Cities: ${previousCities}
   Previous Counties: ${previousCounties}
   Validator Reason: ${reason}`;
}).join('\n\n')}

Return a JSON array where each element is an array of city names for the corresponding article. Only include cities that are explicitly mentioned in the article. Use standard city names (e.g., "New York" not "NYC", "Los Angeles" not "LA").

Examples of major US cities to look for:
- New York Metro: New York, Brooklyn, Queens, Bronx, Manhattan
- Los Angeles Metro: Los Angeles, Long Beach, Anaheim, Santa Ana, Irvine
- Chicago Metro: Chicago, Aurora, Naperville, Joliet, Elgin
- Dallas Metro: Dallas, Fort Worth, Arlington, Plano, Garland
- Houston Metro: Houston, Sugar Land, The Woodlands, Pearland, Baytown

Return a JSON array where each element is an array of city names for the corresponding article. Leave empty if no specific city is mentioned.

Example: [["New York", "Brooklyn"], [], ["Los Angeles", "Santa Monica"]]`;

        const result = await pRetry(
          () => makeGeminiCall("gemini-3-flash-preview", prompt, {
            operation: "categorize-cities",
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "ARRAY",
                items: {
                  type: "STRING"
                }
              }
            }
          }),
          { retries: 2 }
        );

        if (!result?.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error("Invalid response structure from Gemini:", JSON.stringify(result, null, 2));
            throw new Error("Invalid response from Gemini API: missing candidates[0].content.parts[0].text");
        }

        const categories = JSON.parse(result.candidates[0].content.parts[0].text);

        return categories;
    } catch (error) {
        console.error("Error in city categorization:", error);
        throw error;
    }
}

export async function getArticleTags(articles: { title: string; description?: string }[]): Promise<string[][]> {
  if (articles.length === 0) return [];

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn("GEMINI_API_KEY not set, skipping article tagging");
    return articles.map(() => []);
  }

  try {
    const prompt = `You are a real estate news categorizer. For each article, assign relevant tags from these categories:

${Object.entries(TAG_CATEGORIES).map(([category, description]) =>
  `${category}: ${description}`
).join('\n')}

Articles:
${articles.map((article, index) => `${index}. Title: ${article.title}\n   Description: ${article.description || 'No description'}`).join('\n\n')}

Return a JSON array where each element is an array of relevant tags for the corresponding article. Choose the most relevant tags from the categories above.

Example: [["multifamily", "development"], ["financing", "investment"], ["market-analysis"]]`;

    const result = await pRetry(
      () => makeGeminiCall("gemini-3-flash-preview", prompt, {
        operation: "tag-articles",
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "ARRAY",
            items: {
              type: "STRING"
            }
          }
        }
      }),
      { retries: 2 }
    );

    const tags = JSON.parse(result.candidates[0].content.parts[0].text);

    return tags;
  } catch (error) {
    console.error("Error in article tagging:", error);
    throw error;
  }
}
