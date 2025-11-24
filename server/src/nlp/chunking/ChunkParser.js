/**
 * Chunk Parser - Shallow Parsing for NP/VP/PP Extraction
 * 
 * Chunking (Shallow Parsing) is the process of segmenting a sentence into
 * non-overlapping constituents such as Noun Phrases (NP), Verb Phrases (VP),
 * and Prepositional Phrases (PP).
 * 
 * Unlike full parsing (which builds complete hierarchical trees), chunking
 * creates a flat structure, which is sufficient for identifying the "Subject"
 * of a video prompt.
 * 
 * This module implements:
 * - Noun Phrase extraction (captures complete visual entities with all modifiers)
 * - Verb Phrase extraction (captures actions for animation)
 * - Prepositional Phrase extraction (captures spatial relationships)
 * - IOB (Inside, Outside, Beginning) labeling format
 * 
 * Example: "A weathered robotic soldier runs in a dark forest"
 * - NP: "A weathered robotic soldier" (the subject/agent)
 * - VP: "runs" (the action)
 * - PP: "in a dark forest" (the location)
 */

import {

  isNounTag,

  isVerbTag,

  isAdjectiveTag,

  isDeterminerTag,

  isPrepositionTag,

  isAdverbTag,

  isVerbForm,

  isAuxiliaryVerb,

} from '../utils/PennTreebankTags.js';



/**

 * IOB Tag types

 */

export const IOB_TAGS = {

  B_NP: 'B-NP', // Beginning of Noun Phrase

  I_NP: 'I-NP', // Inside Noun Phrase

  B_VP: 'B-VP', // Beginning of Verb Phrase

  I_VP: 'I-VP', // Inside Verb Phrase

  B_PP: 'B-PP', // Beginning of Prepositional Phrase

  I_PP: 'I-PP', // Inside Prepositional Phrase

  O: 'O',       // Outside any chunk

};



/**

 * Chunk types

 */

export const CHUNK_TYPES = {

  NP: 'NP', // Noun Phrase

  VP: 'VP', // Verb Phrase

  PP: 'PP', // Prepositional Phrase

};



/**

 * Chunk object structure

 */

class Chunk {

  constructor(type, tokens, startIndex, endIndex) {

    this.type = type;

    this.tokens = tokens;

    this.startIndex = startIndex;

    this.endIndex = endIndex;

    this.text = tokens.map(t => t.word).join(' ');

    this.charStart = tokens[0].charStart;

    this.charEnd = tokens[tokens.length - 1].charEnd;

  }



  /**

   * Get head noun of NP (rightmost noun)

   */

  getHeadNoun() {

    if (this.type !== CHUNK_TYPES.NP) return null;

    

    // Head noun is typically the rightmost noun in the NP

    for (let i = this.tokens.length - 1; i >= 0; i--) {

      if (isNounTag(this.tokens[i].tag)) {

        return this.tokens[i];

      }

    }

    return null;

  }



  /**

   * Get all modifiers (adjectives, determiners)

   */

  getModifiers() {

    if (this.type !== CHUNK_TYPES.NP) return [];

    

    return this.tokens.filter(t => 

      isAdjectiveTag(t.tag) || isDeterminerTag(t.tag)

    );

  }



  /**

   * Get main verb of VP

   */

  getMainVerb() {

    if (this.type !== CHUNK_TYPES.VP) return null;

    

    // Main verb is typically the first verb in the VP

    for (let i = 0; i < this.tokens.length; i++) {

      if (isVerbTag(this.tokens[i].tag)) {

        return this.tokens[i];

      }

    }

    return null;

  }



  /**

   * Get preposition of PP

   */

  getPreposition() {

    if (this.type !== CHUNK_TYPES.PP) return null;

    

    // Preposition is the first token

    if (this.tokens.length > 0 && isPrepositionTag(this.tokens[0].tag)) {

      return this.tokens[0];

    }

    return null;

  }



  /**

   * Get the NP object within a PP

   */

  getObject() {

    if (this.type !== CHUNK_TYPES.PP) return null;

    

    // Object is typically everything after the preposition

    return this.tokens.slice(1);

  }

}



/**

 * Chunk Parser class

 */

export class ChunkParser {

  /**

   * Extract all chunks from POS-tagged tokens

   * 

   * @param {Array<Object>} tokens - Tokens with PTB tags

   * @returns {Array<Chunk>} Extracted chunks

   */

  static extractChunks(tokens) {

    if (!tokens || tokens.length === 0) return [];

    

    // First, assign IOB tags

    const iobTagged = ChunkParser.assignIOBTags(tokens);

    

    // Then, group into chunks

    const chunks = ChunkParser.groupIntoChunks(iobTagged);

    

    return chunks;

  }



      /**



       * Assign IOB tags to tokens using regex-like patterns



       * 



       * @param {Array<Object>} tokens - POS-tagged tokens



       * @returns {Array<Object>} Tokens with IOB tags



       */



      static assignIOBTags(tokens) {



        const iobTokens = tokens.map(t => ({ ...t, iobTag: IOB_TAGS.O }));



        



        let i = 0;



        while (i < iobTokens.length) {



          // Try to match Noun Phrase pattern: <DT>? <JJ.*>* <NN.*>+



          if (ChunkParser.isNPStart(iobTokens, i)) {



            i = ChunkParser.tagNP(iobTokens, i);



            continue;



          }



          



          // Try to match Verb Phrase pattern: <VB.*>+ (<RB>)?



          if (ChunkParser.isVPStart(iobTokens, i)) {



            i = ChunkParser.tagVP(iobTokens, i);



            continue;



          }



          



          // Try to match Prepositional Phrase pattern: <IN> <NP>



          if (ChunkParser.isPPStart(iobTokens, i)) {



            i = ChunkParser.tagPP(iobTokens, i);



            continue;



          }



          



          i++;



        }



        



        return iobTokens;



      }



    



      /**



       * Check if position starts a Noun Phrase



       * Pattern: <DT>? <JJ.*>* <NN.*>+



       */



      static isNPStart(tokens, i) {



        if (i >= tokens.length) return false;



        



        // Can start with determiner or adjective or noun



        return isDeterminerTag(tokens[i].tag) || 



               isAdjectiveTag(tokens[i].tag) ||



               isNounTag(tokens[i].tag);



      }



    



      /**



       * Tag a Noun Phrase starting at position i



       * Returns the index after the NP



       * 



       * STOP CONDITIONS to prevent overly long chunks:



       * - Stop at verbs, prepositions, conjunctions



       * - Max length: 3 tokens



       */



      static tagNP(tokens, start) {



        let i = start;



        let foundNoun = false;



        const MAX_NP_LENGTH = 3; // Prevent runaway chunks



        



        // Optional determiner



        if (i < tokens.length && isDeterminerTag(tokens[i].tag)) {



          tokens[i].iobTag = IOB_TAGS.B_NP;



          i++;



        }



        



        // Zero or more adjectives (max 3 to prevent long chains)



        let adjCount = 0;



        while (i < tokens.length && isAdjectiveTag(tokens[i].tag) && adjCount < 3) {



          if (i === start) {



            tokens[i].iobTag = IOB_TAGS.B_NP;



          } else {



            tokens[i].iobTag = IOB_TAGS.I_NP;



          }



          i++;



          adjCount++;



        }



        



        // One or more nouns (required) - but stop at boundaries



        let nounCount = 0;



        while (i < tokens.length && isNounTag(tokens[i].tag)) {



          // Stop if we hit max length



          if ((i - start) >= MAX_NP_LENGTH) {



            break;



          }



          



          // Tag this noun



          if (i === start) {



            tokens[i].iobTag = IOB_TAGS.B_NP;



          } else {



            tokens[i].iobTag = IOB_TAGS.I_NP;



          }



          foundNoun = true;



          nounCount++;



          i++;



          



          // AFTER consuming the noun, check if we should stop



          // Look at the NEXT token to decide if we continue



          if (i < tokens.length) {



            const nextToken = tokens[i];



            // Stop before verbs, prepositions, conjunctions, punctuation



            if (isVerbForm(nextToken) || 



                isPrepositionTag(nextToken.tag) ||



                isAdverbTag(nextToken.tag) || // Adverbs often start VPs



                nextToken.tag === 'CC' || // Coordinating conjunction (and, or, but)



                nextToken.word === ',' ||



                nextToken.word === ';' ||



                nextToken.word === '.') {



              break;



            }



            // Also stop if next is NOT a noun (prevents runaway)



            if (!isNounTag(nextToken.tag)) {



              break;



            }



          }



        }



        



        // If we didn't find a noun, this wasn't a valid NP



        if (!foundNoun && start < i) {



          // Reset tags



          for (let j = start; j < i; j++) {



            tokens[j].iobTag = IOB_TAGS.O;



          }



          return start + 1;



        }



        



        return i;



      }



    



      /**



       * Check if position starts a Verb Phrase



       * Pattern: <VB.*>+ (<RB>)?



       */



      static isVPStart(tokens, i) {



        if (i >= tokens.length) return false;



        return isVerbForm(tokens[i]);



      }



  /**

   * Tag a Verb Phrase starting at position i

   */

  static tagVP(tokens, start) {

    let i = start;

    

    // One or more verbs

    while (i < tokens.length && isVerbTag(tokens[i].tag)) {

      if (i === start) {

        tokens[i].iobTag = IOB_TAGS.B_VP;

      } else {

        tokens[i].iobTag = IOB_TAGS.I_VP;

      }

      i++;

    }

    

    // Optional adverb modifier

    if (i < tokens.length && isAdverbTag(tokens[i].tag)) {

      tokens[i].iobTag = IOB_TAGS.I_VP;

      i++;

    }

    

    return i;

  }



  /**

   * Check if position starts a Prepositional Phrase

   * Pattern: <IN> <NP>

   */

  static isPPStart(tokens, i) {. // <--- This dot is present in the replace string too

    if (i >= tokens.length) return false;

    return isPrepositionTag(tokens[i].tag);

  }



  /**

   * Tag a Prepositional Phrase starting at position i

   */

  static tagPP(tokens, start) {

    let i = start;

    

    // Preposition

    if (i < tokens.length && isPrepositionTag(tokens[i].tag)) {

      tokens[i].iobTag = IOB_TAGS.B_PP;

      i++;

    }

    

    // Following NP (if any)

    if (i < tokens.length && ChunkParser.isNPStart(tokens, i)) {

      const npStart = i;

      i = ChunkParser.tagNPWithinPP(tokens, i);

    }

    

    return i;

  }



  /**

   * Tag NP within a PP (changes tags to I-PP instead of NP tags)

   */

  static tagNPWithinPP(tokens, start) {

    let i = start;

    

    // Optional determiner

    if (i < tokens.length && isDeterminerTag(tokens[i].tag)) {

      tokens[i].iobTag = IOB_TAGS.I_PP;

      i++;

    }

    

    // Zero or more adjectives

    while (i < tokens.length && isAdjectiveTag(tokens[i].tag)) {

      tokens[i].iobTag = IOB_TAGS.I_PP;

      i++;

    }

    

    // One or more nouns

    while (i < tokens.length && isNounTag(tokens[i].tag)) {

      tokens[i].iobTag = IOB_TAGS.I_PP;

      i++;

    }

    

    return i;

  }



  /**

   * Group IOB-tagged tokens into Chunk objects

   * 

   * @param {Array<Object>} iobTokens - Tokens with IOB tags

   * @returns {Array<Chunk>} Chunk objects

   */

  static groupIntoChunks(iobTokens) {

    const chunks = [];

    let currentChunk = null;

    let chunkTokens = [];

    let chunkStart = -1;

    

    for (let i = 0; i < iobTokens.length; i++) {

      const token = iobTokens[i];

      const iobTag = token.iobTag;

      

      if (iobTag.startsWith('B-')) {

        // Beginning of new chunk

        // Save previous chunk if exists

        if (currentChunk && chunkTokens.length > 0) {

          chunks.push(new Chunk(currentChunk, chunkTokens, chunkStart, i - 1));

        }

        

        // Start new chunk

        currentChunk = iobTag.substring(2); // Extract NP, VP, or PP

        chunkTokens = [token];

        chunkStart = i;

      } else if (iobTag.startsWith('I-')) {

        // Inside current chunk

        const chunkType = iobTag.substring(2);

        if (currentChunk === chunkType) {

          chunkTokens.push(token);

        }

        else {

          // Mismatch, start new chunk

          if (currentChunk && chunkTokens.length > 0) {

            chunks.push(new Chunk(currentChunk, chunkTokens, chunkStart, i - 1));

          }

          currentChunk = chunkType;

          chunkTokens = [token];

          chunkStart = i;

        }

      } else {

        // Outside any chunk (O tag)

        // Save previous chunk if exists

        if (currentChunk && chunkTokens.length > 0) {

          chunks.push(new Chunk(currentChunk, chunkTokens, chunkStart, i - 1));

        }

        currentChunk = null;

        chunkTokens = [];

        chunkStart = -1;

      }

    }

    

    // Save final chunk if exists

    if (currentChunk && chunkTokens.length > 0) {

      chunks.push(new Chunk(currentChunk, chunkTokens, chunkStart, iobTokens.length - 1));

    }

    

    return chunks;

  }



  /**

   * Extract only Noun Phrases

   * 

   * @param {Array<Object>} tokens - POS-tagged tokens

   * @returns {Array<Chunk>} NP chunks

   */

  static extractNounPhrases(tokens) {

    const chunks = ChunkParser.extractChunks(tokens);

    return chunks.filter(c => c.type === CHUNK_TYPES.NP);

  }



  /**

   * Extract only Verb Phrases

   * 

   * @param {Array<Object>} tokens - POS-tagged tokens

   * @returns {Array<Chunk>} VP chunks

   */

  static extractVerbPhrases(tokens) {

    const chunks = ChunkParser.extractChunks(tokens);

    return chunks.filter(c => c.type === CHUNK_TYPES.VP);

  }



  /**

   * Extract only Prepositional Phrases

   * 

   * @param {Array<Object>} tokens - POS-tagged tokens

   * @returns {Array<Chunk>} PP chunks

   */

  static extractPrepositionalPhrases(tokens) {

    const chunks = ChunkParser.extractChunks(tokens);

    return chunks.filter(c => c.type === CHUNK_TYPES.PP);

  }



  /**

   * Analyze chunk structure of a sentence

   * 

   * @param {Array<Object>} tokens - POS-tagged tokens

   * @returns {Object} Chunk analysis

   */

  static analyzeChunks(tokens) {

    const chunks = ChunkParser.extractChunks(tokens);

    

    const nps = chunks.filter(c => c.type === CHUNK_TYPES.NP);

    const vps = chunks.filter(c => c.type === CHUNK_TYPES.VP);

    const pps = chunks.filter(c => c.type === CHUNK_TYPES.PP);

    

    return {

      chunks,

      nounPhrases: nps,

      verbPhrases: vps,

      prepositionalPhrases: pps,

      stats: {

        totalChunks: chunks.length,

        npCount: nps.length,

        vpCount: vps.length,

        ppCount: pps.length,

      },

    };

  }

}



export { Chunk };

export default ChunkParser;



