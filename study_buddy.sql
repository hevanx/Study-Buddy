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
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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

-- Users (passwords in order: password123, studyhard, silverpass, bronzeboy, newuser1)
INSERT INTO `users` (`id`, `username`, `email`, `password`, `created_at`) VALUES
(1, 'hevan',        'hevan@example.com',       '$2a$10$FSIGDi0YOTNQAPA2qEcz8OXQfdnIPaGbW1eYZTsjsCHysZ4/S8SpC', '2026-01-15 09:00:00'),
(2, 'alex_studies', 'alex@example.com',        '$2a$10$w6cI8T0EUzwwBckveNP7uuknTFoXBRTPHDuGxZ1uDdTAjE9lePJje', '2026-01-20 14:30:00'),
(3, 'diamondDave',  'dave@example.com',        '$2a$10$9zJ7HtXkTpfAXrFmdRrzJ.1/AQb74tQUGZM278p7KYIzArWHsyOzW', '2026-02-01 11:15:00'),
(4, 'goldie',       'goldie@example.com',      '$2a$10$SBUG70B1I2u5BGDbnmVMGu3JiC.LZOikocPiS5emZgbhIKZ63F7oe', '2026-02-10 16:45:00'),
(5, 'silverstar',   'silverstar@example.com',  '$2a$10$V3IwuDW61UXaUbYmsk7WPek4gHU4j7UAb4k3KJtiN.m/2v.A6QtX6', '2026-02-20 08:00:00');

-- XP progress — one user per rank (Diamond/Gold/Silver/Bronze/Unranked)
INSERT INTO `user_progress` (`id`, `user_id`, `total_xp`, `total_study_seconds`, `last_updated_at`) VALUES
(1, 1, 1100.0000, 39600.000, '2026-03-01 18:00:00'),  -- Diamond  (1000+ XP, 11h)
(2, 2,  700.0000, 25200.000, '2026-02-28 20:00:00'),  -- Gold     (600+ XP,  7h)
(3, 3,  400.0000, 14400.000, '2026-03-02 09:30:00'),  -- Silver   (300+ XP,  4h)
(4, 4,  150.0000,  5400.000, '2026-02-27 15:00:00'),  -- Bronze   (100+ XP,  1.5h)
(5, 5,   50.0000,  1800.000, '2026-02-25 12:00:00');  -- Unranked (<100 XP,  0.5h)

-- Equipped cosmetics — only items the user's rank has unlocked
-- Unlocks: glasses-1 @ Bronze, shoes-1 @ Silver, hat-1 & shirt-1 @ Gold, crown-1 @ Diamond
INSERT INTO `user_cosmetics` (`id`, `user_id`, `hat_id`, `glasses_id`, `shirt_id`, `shoes_id`, `updated_at`) VALUES
(1, 1, 'crown-1',   NULL, 'shirt-1', 'shoes-1', '2026-03-01 18:00:00'),  -- Diamond: crown + shirt + shoes
(2, 2, 'hat-1',     NULL, 'shirt-1', 'shoes-1', '2026-02-28 20:00:00'),  -- Gold: hat + shirt + shoes
(3, 3, 'glasses-1', NULL, NULL,      'shoes-1', '2026-03-02 09:30:00'),  -- Silver: glasses + shoes
(4, 4, 'glasses-1', NULL, NULL,      NULL,      '2026-02-27 15:00:00'),  -- Bronze: glasses only
(5, 5, NULL,        NULL, NULL,      NULL,      '2026-02-25 12:00:00');  -- Unranked: nothing

-- Timer state (accumulated_ms matches study seconds × 1000)
INSERT INTO `timer_state` (`id`, `user_id`, `accumulated_ms`, `state`, `saved_at`) VALUES
(1, 1, 39600000, 'stopped', '2026-03-01 18:00:00'),
(2, 2, 25200000, 'stopped', '2026-02-28 20:00:00'),
(3, 3, 14400000, 'stopped', '2026-03-02 09:30:00'),
(4, 4,  5400000, 'stopped', '2026-02-27 15:00:00'),
(5, 5,  1800000, 'stopped', '2026-02-25 12:00:00');

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
