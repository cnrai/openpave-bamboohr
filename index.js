#!/usr/bin/env node
/**
 * BambooHR CLI - PAVE Sandbox Version
 * 
 * Query BambooHR for time off and employee information.
 * Uses the PAVE sandbox secure token system for authentication.
 * 
 * Token configuration in ~/.pave/permissions.yaml:
 * tokens:
 *   bamboohr:
 *     env: BAMBOOHR_API_KEY
 *     type: api_key
 *     domains:
 *       - api.bamboohr.com
 *     placement:
 *       type: header
 *       name: Authorization
 *       format: "Basic {token}"
 *     encoding: basic_with_x
 * 
 * Configuration:
 *   --company <domain>    - Company domain (default: crholdingslimited)
 */

// Parse command line arguments  
const args = process.argv.slice(2);

function parseArgs() {
  const parsed = {
    command: null,
    positional: [],
    options: {}
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('-')) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=', 2);
        if (value !== undefined) {
          parsed.options[key] = value;
        } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          parsed.options[key] = args[i + 1];
          i++;
        } else {
          parsed.options[key] = true;
        }
      } else {
        const flag = arg.slice(1);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          parsed.options[flag] = args[i + 1];
          i++;
        } else {
          parsed.options[flag] = true;
        }
      }
    } else {
      if (parsed.command === null) {
        parsed.command = arg;
      } else {
        parsed.positional.push(arg);
      }
    }
  }
  
  return parsed;
}

// URL encoding function for sandbox compatibility
function encodeQueryParams(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

// Base64 encoding for Basic Auth
function base64Encode(str) {
  // Simple base64 encoding for sandbox
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : 0;
    const c = i < str.length ? str.charCodeAt(i++) : 0;
    
    const n = (a << 16) | (b << 8) | c;
    
    result += chars[(n >> 18) & 63];
    result += chars[(n >> 12) & 63];
    result += i > str.length + 1 ? '=' : chars[(n >> 6) & 63];
    result += i > str.length ? '=' : chars[n & 63];
  }
  
  return result;
}

// BambooHR Client Class
class BambooClient {
  constructor(options = {}) {
    this.companyDomain = options.companyDomain || 'crholdingslimited';
    this.baseUrl = `https://api.bamboohr.com/api/gateway.php/${this.companyDomain}/v1`;
    this.useSecureToken = typeof hasToken === 'function' && hasToken('bamboohr');
    this.apiKey = options.apiKey || null;
  }

  /**
   * Show instructions for configuring the token
   */
  static showTokenInstructions() {
    console.error('❌ BambooHR token not configured.');
    console.error('');
    console.error('Add to ~/.pave/permissions.yaml:');
    console.error('');
    console.error('tokens:');
    console.error('  bamboohr:');
    console.error('    env: BAMBOOHR_API_KEY');
    console.error('    type: api_key');
    console.error('    domains:');
    console.error('      - api.bamboohr.com');
    console.error('    placement:');
    console.error('      type: header');
    console.error('      name: Authorization');
    console.error('      format: "Basic {token}"');
    console.error('    encoding: basic_with_x');
    console.error('');
    console.error('Then add to ~/.pave/tokens.yaml:');
    console.error('');
    console.error('BAMBOOHR_API_KEY: your-api-key-here');
    console.error('');
    console.error('Get your API key from: BambooHR > Settings > API Keys');
  }

  /**
   * Make an authenticated request to the BambooHR API
   */
  request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Use secure token system if available
    if (this.useSecureToken) {
      const response = authenticatedFetch('bamboohr', url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          ...options.headers,
        },
        timeout: options.timeout || 30000
      });

      // Handle response
      if (!response.ok) {
        const error = new Error(response.statusText || `HTTP ${response.status}`);
        error.status = response.status;
        try {
          error.data = response.json();
        } catch (e) {
          error.data = response.text();
        }
        throw error;
      }

      // Try to parse as JSON
      try {
        return response.json();
      } catch (e) {
        return response.text();
      }
    }

    // Fallback to manual auth (for testing outside sandbox)
    if (!this.apiKey) {
      BambooClient.showTokenInstructions();
      throw new Error('BambooHR API key not configured');
    }

    const auth = base64Encode(`${this.apiKey}:x`);
    const response = fetch(url, {
      ...options,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        ...options.headers,
      },
      timeout: options.timeout || 30000
    });

    if (!response.ok) {
      const error = new Error(response.statusText || `HTTP ${response.status}`);
      error.status = response.status;
      try {
        error.data = response.json();
      } catch (e) {
        error.data = response.text();
      }
      throw error;
    }

    try {
      return response.json();
    } catch (e) {
      return response.text();
    }
  }

  /**
   * Get who's out today or within a date range
   */
  getWhosOut(options = {}) {
    const params = {};
    if (options.start) params.start = options.start;
    if (options.end) params.end = options.end;
    
    const queryString = encodeQueryParams(params);
    return this.request(`/time_off/whos_out/${queryString}`);
  }

  /**
   * Get who's out this week (Monday to Sunday)
   */
  getWhosOutThisWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Calculate Monday of this week
    const monday = new Date(today);
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(today.getDate() + daysToMonday);
    
    // Calculate Sunday of this week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const start = monday.toISOString().split('T')[0];
    const end = sunday.toISOString().split('T')[0];

    return this.getWhosOut({ start, end });
  }

  /**
   * Get employee directory
   */
  getEmployeeDirectory() {
    return this.request('/employees/directory');
  }

  /**
   * Get a specific employee by ID
   */
  getEmployee(employeeId, fields = ['firstName', 'lastName', 'displayName', 'jobTitle', 'department', 'workEmail']) {
    const fieldsParam = fields.join(',');
    return this.request(`/employees/${employeeId}?fields=${fieldsParam}`);
  }

  /**
   * Get time off requests
   */
  getTimeOffRequests(options = {}) {
    const params = {};
    if (options.start) params.start = options.start;
    if (options.end) params.end = options.end;
    if (options.status) params.status = options.status;
    if (options.employeeId) params.employeeId = options.employeeId;

    const queryString = encodeQueryParams(params);
    return this.request(`/time_off/requests/${queryString}`);
  }

  /**
   * Get list of time off types
   */
  getTimeOffTypes() {
    return this.request('/meta/time_off/types');
  }

  // ============================================
  // Applicant Tracking System (ATS) Methods
  // ============================================

  /**
   * Get list of applicant statuses
   */
  getApplicantStatuses() {
    return this.request('/applicant_tracking/statuses');
  }

  /**
   * Get job applications
   */
  getApplications(options = {}) {
    const params = {};
    if (options.page) params.page = options.page;
    if (options.pageLimit) params.pageLimit = options.pageLimit;
    if (options.jobId) params.jobId = options.jobId;
    if (options.statusId) params.statusId = options.statusId;
    if (options.sortBy) params.sortBy = options.sortBy;
    if (options.sortOrder) params.sortOrder = options.sortOrder;

    const queryString = encodeQueryParams(params);
    return this.request(`/applicant_tracking/applications${queryString}`);
  }

  /**
   * Get a specific application by ID
   */
  getApplication(applicationId) {
    return this.request(`/applicant_tracking/applications/${applicationId}`);
  }

  /**
   * Update applicant status
   */
  updateApplicantStatus(applicationId, statusId) {
    return this.request(`/applicant_tracking/applications/${applicationId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: statusId }),
    });
  }

  /**
   * Add a comment to an application
   */
  addApplicationComment(applicationId, comment) {
    return this.request(`/applicant_tracking/applications/${applicationId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment }),
    });
  }

  /**
   * Create a new candidate application
   */
  addCandidate(candidateData) {
    const { firstName, lastName, jobId, email, phone, address, city, state, zip, country, source, websiteUrl, linkedinUrl, coverLetter } = candidateData;

    if (!firstName || !lastName || !jobId) {
      throw new Error('firstName, lastName, and jobId are required');
    }

    const payload = {
      firstName,
      lastName,
      jobId: String(jobId),
    };

    if (email) payload.email = email;
    if (phone) payload.phone = phone;
    if (address) payload.address = address;
    if (city) payload.city = city;
    if (state) payload.state = state;
    if (zip) payload.zip = zip;
    if (country) payload.country = country;
    if (source) payload.source = source;
    if (websiteUrl) payload.websiteUrl = websiteUrl;
    if (linkedinUrl) payload.linkedinUrl = linkedinUrl;
    if (coverLetter) payload.coverLetter = coverLetter;

    return this.request('/applicant_tracking/application', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get job summaries (open positions)
   */
  getJobSummaries(options = {}) {
    const params = {};
    if (options.statusGroups) params.statusGroups = options.statusGroups;
    if (options.sortBy) params.sortBy = options.sortBy;
    if (options.sortOrder) params.sortOrder = options.sortOrder;

    const queryString = encodeQueryParams(params);
    return this.request(`/applicant_tracking/jobs${queryString}`);
  }

  /**
   * Download candidate resume/CV file
   * @param {string} applicationId - The application ID
   * @param {string} outputPath - Path to save the file (optional)
   * @returns {Object} - Object with file info: { filename, filepath, size }
   */
  downloadCandidateResume(applicationId, outputPath = null) {
    const fs = require('fs');
    
    // First get application details to check if resume exists
    const application = this.getApplication(applicationId);
    
    if (!application.resumeFileId) {
      throw new Error('No resume file found for this candidate');
    }

    // Download the resume file using the files endpoint with resumeFileId
    // BambooHR stores resumes as files - we need to use the files API
    const fileId = application.resumeFileId;
    const url = `${this.baseUrl}/files/${fileId}`;
    
    let response;
    if (this.useSecureToken) {
      response = authenticatedFetch('bamboohr', url, {
        timeout: 30000
      });
    } else {
      if (!this.apiKey) {
        throw new Error('BambooHR API key not configured');
      }
      const auth = base64Encode(`${this.apiKey}:x`);
      response = fetch(url, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
        timeout: 30000
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to download resume: HTTP ${response.status} - ${response.statusText}`);
    }

    // Determine filename from Content-Disposition header, API response, or use default
    let filename = application.resumeFileName || `candidate_${applicationId}_resume`;
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition && contentDisposition.includes('filename=')) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Add extension based on content type if not present
    const contentType = response.headers.get('content-type');
    if (!filename.includes('.')) {
      if (contentType && contentType.includes('pdf')) {
        filename += '.pdf';
      } else if (contentType && contentType.includes('word')) {
        filename += '.docx';
      } else {
        filename += '.pdf'; // Default to PDF
      }
    }

    // Determine output path
    const finalPath = outputPath || `tmp/${filename}`;
    
    // Ensure tmp directory exists
    if (finalPath.includes('/')) {
      const dir = finalPath.substring(0, finalPath.lastIndexOf('/'));
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
          // Ignore errors if directory creation fails
        }
      }
    }

    // Write file
    const content = response.text(); // Get as binary string
    fs.writeFileSync(finalPath, content, 'binary');

    const stats = fs.statSync(finalPath);

    return {
      filename,
      filepath: finalPath,
      size: stats.size,
      contentType: contentType || 'application/octet-stream'
    };
  }

  /**
   * Get comments/notes for a candidate application
   * @param {string} applicationId - The application ID
   * @returns {Array} - Array of comments with author and date info
   */
  getCandidateComments(applicationId) {
    return this.request(`/applicant_tracking/applications/${applicationId}/comments`);
  }

  /**
   * Get application notes (private internal notes)
   * @param {string} applicationId - The application ID
   * @returns {Object} - Notes data
   */
  getCandidateNotes(applicationId) {
    return this.request(`/applicant_tracking/applications/${applicationId}/notes`);
  }

  /**
   * Add or update application notes
   * @param {string} applicationId - The application ID
   * @param {string} notes - Notes text to add/update
   * @returns {Object} - Result object
   */
  updateCandidateNotes(applicationId, notes) {
    return this.request(`/applicant_tracking/applications/${applicationId}/notes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });
  }
}

// ============================================
// Output Formatting Functions
// ============================================

function formatDate(date) {
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function printWhosOutSummary(data, isWeek = false) {
  if (!data || data.length === 0) {
    console.log(isWeek ? 'No one is out this week.' : 'No one is out.');
    return;
  }

  const today = new Date();

  // Group by person
  const byPerson = {};
  for (const entry of data) {
    const name = entry.name || 'Unknown';
    if (!byPerson[name]) {
      byPerson[name] = {
        name,
        type: entry.type || 'Time Off',
        start: entry.start,
        end: entry.end,
      };
    }
  }

  // Calculate date range header
  let header;
  if (isWeek) {
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(today.getDate() + daysToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    header = `Who's Out This Week (${formatDate(monday)} - ${formatDate(sunday)})`;
  } else {
    header = `Who's Out`;
  }

  console.log(header);
  console.log('='.repeat(header.length));
  console.log('');

  const entries = Object.values(byPerson);
  entries.sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  for (const entry of entries) {
    const dateRange = entry.start === entry.end || !entry.end
      ? formatDate(new Date(entry.start))
      : `${formatDate(new Date(entry.start))} - ${formatDate(new Date(entry.end))}`;
    
    const typeStr = entry.type ? ` (${entry.type})` : '';
    console.log(`• ${entry.name}: ${dateRange}${typeStr}`);
  }

  console.log('');
  console.log(`Total: ${entries.length} ${entries.length === 1 ? 'person' : 'people'} out`);
}

function printCandidatesSummary(data) {
  const applications = data.applications || [];
  
  if (applications.length === 0) {
    console.log('No candidates found.');
    return;
  }

  console.log('Candidates');
  console.log('==========\n');

  for (const app of applications) {
    const name = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const job = app.job?.title?.label || 'Unknown Position';
    const status = app.status?.label || 'Unknown';
    const date = new Date(app.appliedDate).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric' 
    });
    const rating = app.rating ? `${'⭐'.repeat(app.rating)}` : 'No rating';
    
    console.log(`[${app.id}] ${name}`);
    console.log(`    📋 Position: ${job}`);
    console.log(`    📊 Status: ${status}`);
    console.log(`    📅 Applied: ${date}`);
    console.log(`    ✉️  Email: ${app.applicant.email}`);
    console.log(`    ${rating}`);
    console.log('');
  }

  console.log(`Total: ${applications.length} candidate(s)`);
  if (!data.paginationComplete) {
    console.log('(More results available - use --page to paginate)');
  }
}

function printCandidateSummary(app) {
  const name = `${app.applicant.firstName} ${app.applicant.lastName}`;
  const job = app.job?.title?.label || 'Unknown Position';
  const status = app.status?.label || 'Unknown';
  const date = new Date(app.appliedDate).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric' 
  });

  console.log(`Candidate: ${name}`);
  console.log('='.repeat(40));
  console.log(`Application ID: ${app.id}`);
  console.log(`Position: ${job}`);
  console.log(`Status: ${status}`);
  console.log(`Applied: ${date}`);
  console.log('');
  console.log('Contact:');
  console.log(`  Email: ${app.applicant.email || 'N/A'}`);
  console.log(`  Phone: ${app.applicant.phoneNumber || 'N/A'}`);
  console.log(`  LinkedIn: ${app.applicant.linkedinUrl || 'N/A'}`);
  console.log('');
  console.log(`Source: ${app.applicant.source || 'N/A'}`);
  console.log(`Desired Salary: ${app.desiredSalary || 'N/A'}`);
  console.log(`Available Start: ${app.applicant.availableStartDate || 'N/A'}`);
  
  if (app.status?.changedByUser) {
    const changedBy = `${app.status.changedByUser.firstName} ${app.status.changedByUser.lastName}`;
    const changedDate = new Date(app.status.dateChanged).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    console.log(`\nStatus changed by: ${changedBy} on ${changedDate}`);
  }
  
  console.log(`\nFiles & Feedback:`);
  console.log(`  Resume/CV: ${app.resumeFileId ? '✅ Available' : '❌ Not uploaded'}`);
  console.log(`  Cover Letter: ${app.coverLetterFileId ? '✅ Available' : '❌ Not uploaded'}`);
  console.log(`  Comments: ${app.commentCount || 0}`);
  console.log(`  Emails: ${app.emailCount || 0}`);
  
  if (app.resumeFileId) {
    console.log(`\n💡 To download CV: node bamboohr.js download-cv ${app.id}`);
  }
  if ((app.commentCount || 0) > 0) {
    console.log(`💡 To view comments: node bamboohr.js candidate-comments ${app.id} --summary`);
  }
  console.log(`💡 To view/edit notes: node bamboohr.js candidate-notes ${app.id} --summary`);
}

function printCandidateCommentsSummary(comments, applicationId) {
  console.log(`Comments for Application ${applicationId}`);
  console.log('='.repeat(40));
  
  if (!comments || comments.length === 0) {
    console.log('No comments found.');
    return;
  }

  for (const comment of comments) {
    const date = new Date(comment.createdDate).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const author = comment.createdByUser ? 
      `${comment.createdByUser.firstName} ${comment.createdByUser.lastName}` : 
      'System';
    
    console.log(`\n[${comment.id}] ${author} - ${date}`);
    console.log(`${comment.comment}`);
  }
  
  console.log(`\nTotal: ${comments.length} comment(s)`);
}

function printCandidateNotesSummary(notes, applicationId) {
  console.log(`Private Notes for Application ${applicationId}`);
  console.log('='.repeat(40));
  
  if (!notes || !notes.notes) {
    console.log('No private notes found.');
    return;
  }

  const lastModified = notes.lastModified ? 
    new Date(notes.lastModified).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 
    'Unknown';
  
  const modifiedBy = notes.lastModifiedByUser ? 
    `${notes.lastModifiedByUser.firstName} ${notes.lastModifiedByUser.lastName}` : 
    'Unknown';
  
  console.log(`Last modified: ${lastModified} by ${modifiedBy}\n`);
  console.log(notes.notes);
}

function printStatusesSummary(statuses) {
  console.log('Applicant Statuses');
  console.log('==================\n');

  const enabled = statuses.filter(s => s.enabled);
  const disabled = statuses.filter(s => !s.enabled);

  console.log('✅ Enabled Statuses:');
  for (const status of enabled) {
    const code = status.code ? ` (${status.code})` : '';
    console.log(`  [${status.id}] ${status.name}${code}`);
  }

  if (disabled.length > 0) {
    console.log('\n❌ Disabled Statuses:');
    for (const status of disabled) {
      const code = status.code ? ` (${status.code})` : '';
      console.log(`  [${status.id}] ${status.name}${code}`);
    }
  }

  console.log(`\nTotal: ${statuses.length} statuses (${enabled.length} enabled, ${disabled.length} disabled)`);
}

function printJobsSummary(data) {
  const jobs = data || [];
  
  if (jobs.length === 0) {
    console.log('No jobs found.');
    return;
  }

  console.log('Job Openings');
  console.log('============\n');

  for (const job of jobs) {
    const location = job.location?.city ? `${job.location.city}, ${job.location.state || job.location.country}` : 'Remote/Unspecified';
    const statusIcon = job.status?.label === 'Open' ? '🟢' : '⚪';
    console.log(`${statusIcon} [${job.id}] ${job.title?.label || 'Untitled'}`);
    console.log(`    Status: ${job.status?.label || 'Unknown'}`);
    console.log(`    Location: ${location}`);
    console.log(`    Openings: ${job.numberOfOpenings || 'N/A'}`);
    console.log(`    Applicants: ${job.applicantCount || 0}`);
    console.log('');
  }

  console.log(`Total: ${jobs.length} job(s)`);
}

function printDirectorySummary(data) {
  const employees = data.employees || [];
  
  if (employees.length === 0) {
    console.log('No employees found.');
    return;
  }

  console.log('Employee Directory');
  console.log('==================\n');

  // Group by department
  const byDepartment = {};
  for (const emp of employees) {
    const dept = emp.department || 'No Department';
    if (!byDepartment[dept]) {
      byDepartment[dept] = [];
    }
    byDepartment[dept].push(emp);
  }

  for (const [dept, emps] of Object.entries(byDepartment).sort()) {
    console.log(`📁 ${dept} (${emps.length})`);
    for (const emp of emps.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))) {
      const name = emp.displayName || `${emp.firstName} ${emp.lastName}`;
      const title = emp.jobTitle ? ` - ${emp.jobTitle}` : '';
      console.log(`   • ${name}${title}`);
    }
    console.log('');
  }

  console.log(`Total: ${employees.length} employee(s)`);
}

// Help text
function printHelp() {
  console.log(`
BambooHR CLI - PAVE Sandbox Version

USAGE:
  node bamboohr.js <command> [options]

TIME OFF COMMANDS:
  whos-out                    Get who's out today
  whos-out --week             Get who's out this week (Mon-Sun)
  whos-out -s <date> -e <date>  Who's out in date range
  time-off                    Get time off requests
  time-off-types              List time off types

EMPLOYEE COMMANDS:
  directory                   Get employee directory
  employee <id>               Get specific employee

APPLICANT TRACKING (ATS) COMMANDS:
  candidates                  List job candidates
  candidate <id>              Get specific candidate
  statuses                    List applicant statuses
  jobs                        List job openings
  update-candidate-status <appId> <statusId>
                              Update candidate status
  add-candidate-comment <appId> <comment>
                              Add comment to candidate
  add-candidate               Create new candidate
  download-cv <appId>         Download candidate resume/CV
  candidate-comments <appId>  Get candidate comments
  candidate-notes <appId>     Get candidate private notes
  update-candidate-notes <appId> <notes>
                              Add/update private notes

OPTIONS:
  --company <domain>          Company domain (default: crholdingslimited)
  -s, --start <date>          Start date (YYYY-MM-DD)
  -e, --end <date>            End date (YYYY-MM-DD)
  -w, --week                  This week (Mon-Sun)
  -j, --job <jobId>           Filter by job ID
  --status <status>           Filter by status
  -p, --page <page>           Page number
  -l, --limit <limit>         Results per page (max 100)
  --sort <field>              Sort field
  --order <order>             Sort order (ASC/DESC)
  -o, --output <path>         Output file path (for downloads)
  --summary                   Human-readable output
  --json                      Raw JSON output

EXAMPLES:
  node bamboohr.js whos-out --summary
  node bamboohr.js whos-out --week --summary
  node bamboohr.js directory --summary
  node bamboohr.js candidates --summary
  node bamboohr.js jobs --status OPEN --summary
  node bamboohr.js update-candidate-status 1645 12
  node bamboohr.js download-cv 1712
  node bamboohr.js candidate-comments 1712 --summary
  node bamboohr.js update-candidate-notes 1712 "Strong candidate"

APPLICANT STATUS IDs:
  1  = New              10 = Not a Fit
  12 = Not Qualified    13 = Over Qualified
  14 = Hired Elsewhere  15 = Hired
  16 = Offer Sent       17 = Offer Signed
`);
}

// ============================================
// Main Execution
// ============================================

function main() {
  const parsed = parseArgs();
  
  if (!parsed.command || parsed.command === 'help' || parsed.options.help) {
    printHelp();
    return;
  }

  // Check for secure token
  if (typeof hasToken === 'function' && !hasToken('bamboohr')) {
    BambooClient.showTokenInstructions();
    process.exit(1);
  }

  try {
    const clientOptions = {
      companyDomain: parsed.options.company || 'crholdingslimited'
    };
    
    const client = new BambooClient(clientOptions);
    
    switch (parsed.command) {
      case 'whos-out': {
        let result;
        if (parsed.options.week || parsed.options.w) {
          result = client.getWhosOutThisWeek();
        } else {
          result = client.getWhosOut({
            start: parsed.options.start || parsed.options.s,
            end: parsed.options.end || parsed.options.e,
          });
        }
        
        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (parsed.options.summary) {
          printWhosOutSummary(result, parsed.options.week || parsed.options.w);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }
      
      case 'directory': {
        const result = client.getEmployeeDirectory();
        
        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (parsed.options.summary) {
          printDirectorySummary(result);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }
      
      case 'employee': {
        const id = parsed.positional[0];
        if (!id) {
          console.error('Error: Employee ID required');
          console.error('Usage: node bamboohr.js employee <id>');
          process.exit(1);
        }
        
        const fields = parsed.options.fields 
          ? parsed.options.fields.split(',').map(f => f.trim())
          : undefined;
        
        const result = client.getEmployee(id, fields);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'time-off': {
        const result = client.getTimeOffRequests({
          start: parsed.options.start || parsed.options.s,
          end: parsed.options.end || parsed.options.e,
          status: parsed.options.status,
          employeeId: parsed.options.employee,
        });
        
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'time-off-types': {
        const result = client.getTimeOffTypes();
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'candidates': {
        const result = client.getApplications({
          jobId: parsed.options.job || parsed.options.j,
          statusId: parsed.options.status,
          sortBy: parsed.options.sort,
          sortOrder: parsed.options.order,
          page: parsed.options.page || parsed.options.p,
          pageLimit: parsed.options.limit || parsed.options.l,
        });
        
        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (parsed.options.summary) {
          printCandidatesSummary(result);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }
      
      case 'candidate': {
        const id = parsed.positional[0];
        if (!id) {
          console.error('Error: Application ID required');
          console.error('Usage: node bamboohr.js candidate <id>');
          process.exit(1);
        }
        
        const result = client.getApplication(id);
        
        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (parsed.options.summary) {
          printCandidateSummary(result);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }
      
      case 'statuses': {
        const result = client.getApplicantStatuses();
        
        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (parsed.options.summary) {
          printStatusesSummary(result);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }
      
      case 'jobs': {
        const result = client.getJobSummaries({
          statusGroups: parsed.options.status,
          sortBy: parsed.options.sort,
          sortOrder: parsed.options.order,
        });
        
        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (parsed.options.summary) {
          printJobsSummary(result);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }
      
      case 'update-candidate-status': {
        const applicationId = parsed.positional[0];
        const statusId = parsed.positional[1];
        
        if (!applicationId || !statusId) {
          console.error('Error: Application ID and Status ID required');
          console.error('Usage: node bamboohr.js update-candidate-status <appId> <statusId>');
          process.exit(1);
        }
        
        const result = client.updateApplicantStatus(applicationId, parseInt(statusId, 10));
        console.log(JSON.stringify(result, null, 2));
        console.log(`\n✅ Status updated for application ${applicationId}`);
        break;
      }
      
      case 'add-candidate-comment': {
        const applicationId = parsed.positional[0];
        const comment = parsed.positional.slice(1).join(' ') || parsed.options.comment;
        
        if (!applicationId || !comment) {
          console.error('Error: Application ID and comment required');
          console.error('Usage: node bamboohr.js add-candidate-comment <appId> "comment text"');
          process.exit(1);
        }
        
        const result = client.addApplicationComment(applicationId, comment);
        console.log(JSON.stringify(result, null, 2));
        console.log(`\n✅ Comment added to application ${applicationId}`);
        break;
      }
      
      case 'add-candidate': {
        const firstName = parsed.options['first-name'] || parsed.options.f;
        const lastName = parsed.options['last-name'] || parsed.options.l;
        const jobId = parsed.options.job || parsed.options.j;
        
        if (!firstName || !lastName || !jobId) {
          console.error('Error: First name, last name, and job ID required');
          console.error('Usage: node bamboohr.js add-candidate --first-name <name> --last-name <name> --job <jobId>');
          process.exit(1);
        }
        
        const result = client.addCandidate({
          firstName,
          lastName,
          jobId,
          email: parsed.options.email || parsed.options.e,
          phone: parsed.options.phone || parsed.options.p,
          address: parsed.options.address,
          city: parsed.options.city,
          state: parsed.options.state,
          zip: parsed.options.zip,
          country: parsed.options.country,
          source: parsed.options.source,
          websiteUrl: parsed.options.website,
          linkedinUrl: parsed.options.linkedin,
          coverLetter: parsed.options['cover-letter'],
        });
        
        console.log(JSON.stringify(result, null, 2));
        console.log(`\n✅ Candidate ${firstName} ${lastName} added successfully!`);
        if (result.id) {
          console.log(`Application ID: ${result.id}`);
        }
        break;
      }

      case 'download-cv': {
        const applicationId = parsed.positional[0];
        if (!applicationId) {
          console.error('Error: Application ID required');
          console.error('Usage: node bamboohr.js download-cv <appId> [-o output.pdf]');
          process.exit(1);
        }

        const outputPath = parsed.options.output || parsed.options.o;
        const result = client.downloadCandidateResume(applicationId, outputPath);

        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`✅ Resume downloaded successfully:`);
          console.log(`   File: ${result.filename}`);
          console.log(`   Path: ${result.filepath}`);
          console.log(`   Size: ${(result.size / 1024).toFixed(1)} KB`);
          console.log(`   Type: ${result.contentType}`);
        }
        break;
      }

      case 'candidate-comments': {
        const applicationId = parsed.positional[0];
        if (!applicationId) {
          console.error('Error: Application ID required');
          console.error('Usage: node bamboohr.js candidate-comments <appId>');
          process.exit(1);
        }

        const result = client.getCandidateComments(applicationId);

        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (parsed.options.summary) {
          printCandidateCommentsSummary(result, applicationId);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      case 'candidate-notes': {
        const applicationId = parsed.positional[0];
        if (!applicationId) {
          console.error('Error: Application ID required');
          console.error('Usage: node bamboohr.js candidate-notes <appId>');
          process.exit(1);
        }

        const result = client.getCandidateNotes(applicationId);

        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (parsed.options.summary) {
          printCandidateNotesSummary(result, applicationId);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      case 'update-candidate-notes': {
        const applicationId = parsed.positional[0];
        const notes = parsed.positional.slice(1).join(' ');

        if (!applicationId || !notes) {
          console.error('Error: Application ID and notes text required');
          console.error('Usage: node bamboohr.js update-candidate-notes <appId> "notes text"');
          process.exit(1);
        }

        const result = client.updateCandidateNotes(applicationId, notes);

        if (parsed.options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`✅ Notes updated successfully for application ${applicationId}`);
        }
        break;
      }
      
      default:
        console.error(`Error: Unknown command '${parsed.command}'`);
        console.error('\nRun: node bamboohr.js help');
        process.exit(1);
    }
    
  } catch (error) {
    if (parsed.options.json) {
      console.error(JSON.stringify({
        error: error.message,
        status: error.status,
        data: error.data
      }, null, 2));
    } else {
      console.error(`❌ BambooHR Error: ${error.message}`);
      if (error.status) {
        console.error(`Status: ${error.status}`);
      }
    }
    process.exit(1);
  }
}

// Execute
main();
