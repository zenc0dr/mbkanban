# Codex Analysis Prompt for MBKanban Project

## Context
You are analyzing a Node.js web application called "MBKanban" - a Memory Bank Kanban Board for task management. The project uses Express.js, Tailwind CSS, and integrates with a memory bank system.

## Analysis Instructions

### 1. Code Quality Assessment
- Review all JavaScript files for best practices
- Check for potential bugs, security issues, error handling
- Analyze code structure and architecture
- Identify performance bottlenecks
- Look for code duplication and refactoring opportunities

### 2. Security Analysis
- Check for input validation and sanitization
- Review file system operations for path traversal vulnerabilities
- Analyze CORS configuration
- Check for proper error handling that doesn't leak sensitive information
- Review authentication/authorization mechanisms

### 3. Performance Optimization
- Identify slow database queries or file operations
- Check for memory leaks
- Analyze static file serving efficiency
- Review caching strategies
- Check for unnecessary computations

### 4. User Experience Improvements
- Analyze UI/UX patterns
- Check for accessibility issues
- Review responsive design implementation
- Look for better error messages and user feedback

### 5. Code Structure and Maintainability
- Check for proper separation of concerns
- Analyze module organization
- Look for better abstraction opportunities
- Review naming conventions
- Check for proper documentation

## Implementation Requirements

### Branch Creation
- Create a new branch named: `codex-analysis-improvements`
- All changes must be made on this specific branch

### Comment Style
Add detailed comments in the code explaining:
- What the issue is
- Why it's a problem
- How to fix it
- Alternative approaches if applicable

### Comment Format
```javascript
// CODEX_ISSUE: [Brief description]
// PROBLEM: [Detailed explanation of the issue]
// IMPACT: [What could go wrong]
// SOLUTION: [How to fix it]
// ALTERNATIVE: [Other approaches if applicable]
```

### File Types to Analyze
- `server.js` - Main Express server
- `public/app.js` - Frontend JavaScript
- `public/index.html` - Main HTML template
- `src/` directory files
- `package.json` - Dependencies and scripts
- Any configuration files

### Specific Focus Areas
1. **Error Handling**: Look for unhandled promises, missing try-catch blocks
2. **Security**: Input validation, file path handling, CORS
3. **Performance**: Database queries, file I/O, memory usage
4. **Code Quality**: DRY principle, function complexity, naming
5. **User Experience**: Error messages, loading states, feedback
6. **Maintainability**: Code organization, documentation, testing

### Output Requirements
- Make actual code changes with detailed comments
- Don't just suggest changes - implement them with explanations
- Focus on high-impact, low-risk improvements
- Prioritize security and performance issues
- Add helpful comments that explain the reasoning

### Quality Standards
- All changes must be backward compatible
- Don't break existing functionality
- Focus on improvements that add real value
- Consider the project's specific use case (memory bank integration)
- Maintain the existing code style and patterns

## Success Criteria
- Branch contains meaningful improvements
- All changes are properly commented
- No breaking changes to existing functionality
- Focus on practical, implementable improvements
- Comments explain the "why" not just the "what"

## Remember
This is a real project used for memory bank task management. Focus on improvements that will actually benefit the users and maintainers of this specific application.
