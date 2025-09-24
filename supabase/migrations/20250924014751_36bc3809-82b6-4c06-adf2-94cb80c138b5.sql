-- Add par column to matches table to store par for each hole
ALTER TABLE public.matches 
ADD COLUMN hole_pars jsonb DEFAULT '{"1":4,"2":4,"3":3,"4":4,"5":5,"6":4,"7":3,"8":4,"9":5,"10":4,"11":4,"12":3,"13":4,"14":5,"15":4,"16":3,"17":4,"18":5}'::jsonb;