import axios from 'axios'

// Set VITE_SERVER_URL in a .env file if the central server isn't on localhost:5000
const baseURL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'

const api = axios.create({ baseURL })

export default api
