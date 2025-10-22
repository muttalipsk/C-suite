
import axios from 'axios';

// Configure this environment variable to point to your external Python API
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'https://your-python-api-url.com';

const pythonApiClient = axios.create({
  baseURL: PYTHON_API_URL,
  timeout: 120000, // 2 minutes for AI operations
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function callPythonMeeting(task: string, userProfile: string, agents: string[], turns: number = 1) {
  try {
    const response = await pythonApiClient.post('/meeting', {
      task,
      user_profile: userProfile,
      agents,
      turns,
    });
    return response.data;
  } catch (error: any) {
    console.error('Python API meeting error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to call Python meeting API');
  }
}

export async function callPythonChat(runId: string, agent: string, message: string) {
  try {
    const response = await pythonApiClient.post('/chat', {
      run_id: runId,
      agent,
      message,
    });
    return response.data;
  } catch (error: any) {
    console.error('Python API chat error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to call Python chat API');
  }
}

export async function callPythonGetChat(runId: string, agent: string) {
  try {
    const response = await pythonApiClient.get('/get_chat', {
      params: { run_id: runId, agent },
    });
    return response.data;
  } catch (error: any) {
    console.error('Python API get chat error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to get chat from Python API');
  }
}

export async function healthCheckPython() {
  try {
    const response = await pythonApiClient.get('/');
    return response.data;
  } catch (error) {
    console.error('Python API health check failed:', error);
    return null;
  }
}
