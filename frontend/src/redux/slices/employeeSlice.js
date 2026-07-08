import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axiosConfig';

export const checkIdAvailability = createAsyncThunk(
    'employees/checkId',
    async (employeeId, { rejectWithValue }) => {
        try {
            const response = await api.post('/employees/check-id', { employeeId });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to check ID');
        }
    }
);

// Async Thunks
// ... (no change to imports)

export const fetchEmployees = createAsyncThunk(
    'employees/fetchAll',
    async (params = {}, { rejectWithValue }) => {
        try {
            const { page = 1, limit = 50, search = '' } = params;
            const queryParams = new URLSearchParams();
            if (page) queryParams.append('page', page);
            if (limit) queryParams.append('limit', limit);
            if (search) queryParams.append('search', search);
            
            const response = await api.get(`/employees?${queryParams.toString()}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch employees');
        }
    }
);

export const fetchEmployeeById = createAsyncThunk(
    'employees/fetchById',
    async (id, { rejectWithValue }) => {
        try {
            const response = await api.get(`/employees/${id}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch employee');
        }
    }
);

export const fetchNextEmployeeId = createAsyncThunk(
    'employees/fetchNextId',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/employees/next-id');
            return response.data.nextEmployeeId;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch next employee ID');
        }
    }
);

export const createEmployee = createAsyncThunk(
    'employees/create',
    async (employeeData, { rejectWithValue }) => {
        try {
            const response = await api.post('/employees', employeeData);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to create employee');
        }
    }
);

export const updateEmployee = createAsyncThunk(
    'employees/update',
    async ({ id, employeeData }, { rejectWithValue }) => {
        try {
            const response = await api.put(`/employees/${id}`, employeeData);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to update employee');
        }
    }
);

export const deleteEmployee = createAsyncThunk(
    'employees/delete',
    async (id, { rejectWithValue }) => {
        try {
            await api.delete(`/employees/${id}`);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to delete employee');
        }
    }
);

export const fetchUserByEmployeeId = createAsyncThunk(
    'employees/fetchUserByEmployeeId',
    async (employeeId, { rejectWithValue }) => {
        try {
            const response = await api.get(`/users/employee/${employeeId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch user');
        }
    }
);

// ... (rest of the file)

const employeeSlice = createSlice({
    name: 'employees',
    initialState: {
        items: [],
        total: 0,
        totalPages: 0,
        currentPage: 1,
        currentItem: null,
        loading: false,
        error: null,
        success: false,
    },
    reducers: {
        clearCurrentItem: (state) => {
            state.currentItem = null;
        },
        resetStatus: (state) => {
            state.loading = false;
            state.error = null;
            state.success = false;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch All
            .addCase(fetchEmployees.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchEmployees.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload.data || action.payload;
                state.total = action.payload.total || 0;
                state.totalPages = action.payload.totalPages || 0;
                state.currentPage = action.payload.currentPage || 1;
            })
            .addCase(fetchEmployees.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch By ID
            .addCase(fetchEmployeeById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchEmployeeById.fulfilled, (state, action) => {
                state.loading = false;
                state.currentItem = action.payload.data || action.payload;
            })
            .addCase(fetchEmployeeById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Create
            .addCase(createEmployee.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
            })
            .addCase(createEmployee.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.items.unshift(action.payload.data || action.payload);
            })
            .addCase(createEmployee.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.success = false;
            })
            // Update
            .addCase(updateEmployee.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
            })
            .addCase(updateEmployee.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.currentItem = action.payload.data || action.payload;
                const updatedItem = action.payload.data || action.payload;
                const index = state.items.findIndex(item => item._id === updatedItem._id);
                if (index !== -1) {
                    state.items[index] = updatedItem;
                }
            })
            .addCase(updateEmployee.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.success = false;
            })
            // Delete
            .addCase(deleteEmployee.fulfilled, (state, action) => {
                state.loading = false;
                state.items = state.items.filter(item => item._id !== action.payload);
            })
            .addCase(deleteEmployee.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const { clearCurrentItem, resetStatus } = employeeSlice.actions;
export default employeeSlice.reducer;
