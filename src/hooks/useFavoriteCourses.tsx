import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface FavoriteCourse {
  id: string;
  course_name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

export const useFavoriteCourses = () => {
  const [favorites, setFavorites] = useState<FavoriteCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchFavorites = async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('favorite_courses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorite courses:', error);
      toast.error('Failed to load favorite courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  const addFavorite = async (course: {
    course_name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    if (!user) {
      toast.error('Please sign in to favorite courses');
      return { error: 'Not authenticated' };
    }

    if (favorites.length >= 5) {
      toast.error('You can only have up to 5 favorite courses');
      return { error: 'Maximum favorites reached' };
    }

    try {
      const { data, error } = await supabase
        .from('favorite_courses')
        .insert({
          user_id: user.id,
          course_name: course.course_name,
          address: course.address,
          latitude: course.latitude,
          longitude: course.longitude,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('This course is already in your favorites');
          return { error: 'Duplicate favorite' };
        }
        throw error;
      }

      setFavorites([data, ...favorites]);
      toast.success('Course added to favorites');
      return { data };
    } catch (error) {
      console.error('Error adding favorite:', error);
      toast.error('Failed to add favorite course');
      return { error };
    }
  };

  const removeFavorite = async (courseId: string) => {
    if (!user) return { error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('favorite_courses')
        .delete()
        .eq('id', courseId)
        .eq('user_id', user.id);

      if (error) throw error;

      setFavorites(favorites.filter(f => f.id !== courseId));
      toast.success('Course removed from favorites');
      return { success: true };
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove favorite course');
      return { error };
    }
  };

  const isFavorite = (courseName: string) => {
    return favorites.some(f => f.course_name === courseName);
  };

  const getFavoriteId = (courseName: string) => {
    return favorites.find(f => f.course_name === courseName)?.id;
  };

  return {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavoriteId,
    refetch: fetchFavorites,
  };
};
