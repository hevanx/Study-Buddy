-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 25, 2026 at 07:31 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `study_buddy`
--

-- --------------------------------------------------------

--
-- Table structure for table `friendships`
--

CREATE TABLE `friendships` (
  `id` int(10) UNSIGNED NOT NULL,
  `sender_id` int(10) UNSIGNED NOT NULL,
  `receiver_id` int(10) UNSIGNED NOT NULL,
  `status` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `timer_state`
--

CREATE TABLE `timer_state` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `accumulated_ms` bigint(20) NOT NULL DEFAULT 0,
  `state` enum('stopped','running','paused') NOT NULL DEFAULT 'stopped',
  `session_start` datetime DEFAULT NULL,
  `saved_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------

--
-- Table structure for table `user_cosmetics`
--

CREATE TABLE `user_cosmetics` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `hat_id` varchar(32) DEFAULT NULL,
  `glasses_id` varchar(32) DEFAULT NULL,
  `shirt_id` varchar(32) DEFAULT NULL,
  `shoes_id` varchar(32) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_progress`
--

CREATE TABLE `user_progress` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `total_xp` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `total_study_seconds` decimal(12,3) NOT NULL DEFAULT 0.000,
  `last_updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Sample data
--

-- Users (passwords in order: password123, studyhard, diamond99, golduser, silverstar)
INSERT INTO `users` (`id`, `username`, `email`, `password`, `created_at`) VALUES
(1, 'hevan',        'hevan@example.com',       '$2a$10$FSIGDi0YOTNQAPA2qEcz8OXQfdnIPaGbW1eYZTsjsCHysZ4/S8SpC', '2026-01-15 09:00:00'),
(2, 'alex_studies', 'alex@example.com',        '$2a$10$w6cI8T0EUzwwBckveNP7uuknTFoXBRTPHDuGxZ1uDdTAjE9lePJje', '2026-01-20 14:30:00'),
(3, 'diamondDave',  'dave@example.com',        '$2a$10$9zJ7HtXkTpfAXrFmdRrzJ.1/AQb74tQUGZM278p7KYIzArWHsyOzW', '2026-02-01 11:15:00'),
(4, 'goldie',       'goldie@example.com',      '$2a$10$SBUG70B1I2u5BGDbnmVMGu3JiC.LZOikocPiS5emZgbhIKZ63F7oe', '2026-02-10 16:45:00'),
(5, 'silverstar',   'silverstar@example.com',  '$2a$10$V3IwuDW61UXaUbYmsk7WPek4gHU4j7UAb4k3KJtiN.m/2v.A6QtX6', '2026-02-20 08:00:00');

-- XP progress (100 XP = 1 hour = 3600 study seconds)
INSERT INTO `user_progress` (`id`, `user_id`, `total_xp`, `total_study_seconds`, `last_updated_at`) VALUES
(1, 1, 1050.0000, 37800.000, '2026-03-01 18:00:00'),  -- Diamond
(2, 2,  750.0000, 27000.000, '2026-02-28 20:00:00'),  -- Gold
(3, 3, 1200.0000, 43200.000, '2026-03-02 09:30:00'),  -- Diamond
(4, 4,  620.0000, 22320.000, '2026-02-27 15:00:00'),  -- Gold
(5, 5,  380.0000, 13680.000, '2026-02-25 12:00:00');  -- Silver

-- Equipped cosmetics (hat_id holds hat/crown/glasses — mutually exclusive)
INSERT INTO `user_cosmetics` (`id`, `user_id`, `hat_id`, `glasses_id`, `shirt_id`, `shoes_id`, `updated_at`) VALUES
(1, 1, 'crown-1',   NULL, 'shirt-1', 'shoes-1', '2026-03-01 18:00:00'),  -- crown + shirt + shoes
(2, 2, 'hat-1',     NULL, 'shirt-1', NULL,       '2026-02-28 20:00:00'),  -- hat + shirt
(3, 3, 'crown-1',   NULL, NULL,      'shoes-1',  '2026-03-02 09:30:00'),  -- crown + shoes
(4, 4, 'hat-1',     NULL, NULL,      NULL,       '2026-02-27 15:00:00'),  -- hat only
(5, 5, 'glasses-1', NULL, NULL,      'shoes-1',  '2026-02-25 12:00:00'); -- glasses + shoes

-- Timer state (accumulated_ms matches study seconds × 1000)
INSERT INTO `timer_state` (`id`, `user_id`, `accumulated_ms`, `state`, `saved_at`) VALUES
(1, 1, 37800000, 'stopped', '2026-03-01 18:00:00'),
(2, 2, 27000000, 'stopped', '2026-02-28 20:00:00'),
(3, 3, 43200000, 'stopped', '2026-03-02 09:30:00'),
(4, 4, 22320000, 'stopped', '2026-02-27 15:00:00'),
(5, 5, 13680000, 'stopped', '2026-02-25 12:00:00');

-- Friendships
INSERT INTO `friendships` (`id`, `sender_id`, `receiver_id`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 'accepted', '2026-01-21 10:00:00', '2026-01-21 10:30:00'),
(2, 3, 1, 'accepted', '2026-02-02 12:00:00', '2026-02-02 12:15:00'),
(3, 2, 4, 'accepted', '2026-02-11 09:00:00', '2026-02-11 09:20:00'),
(4, 5, 1, 'pending',  '2026-02-21 14:00:00', '2026-02-21 14:00:00');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `friendships`
--
ALTER TABLE `friendships`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_friendship` (`sender_id`,`receiver_id`),
  ADD KEY `fk_friendship_receiver` (`receiver_id`);

--
-- Indexes for table `timer_state`
--
ALTER TABLE `timer_state`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_timer_user` (`user_id`);

--
-- Indexes for table `user_cosmetics`
--
ALTER TABLE `user_cosmetics`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_cosmetics_user` (`user_id`);

--
-- Indexes for table `user_progress`
--
ALTER TABLE `user_progress`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_progress` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `friendships`
--
ALTER TABLE `friendships`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `timer_state`
--
ALTER TABLE `timer_state`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_cosmetics`
--
ALTER TABLE `user_cosmetics`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_progress`
--
ALTER TABLE `user_progress`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `friendships`
--
ALTER TABLE `friendships`
  ADD CONSTRAINT `fk_friendship_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_friendship_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `timer_state`
--
ALTER TABLE `timer_state`
  ADD CONSTRAINT `fk_timer_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_cosmetics`
--
ALTER TABLE `user_cosmetics`
  ADD CONSTRAINT `fk_cosmetics_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_progress`
--
ALTER TABLE `user_progress`
  ADD CONSTRAINT `fk_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
