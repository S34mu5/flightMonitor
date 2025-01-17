-- MySQL dump 10.13  Distrib 8.0.36, for Win64 (x86_64)
--
-- Host: localhost    Database: flights
-- ------------------------------------------------------
-- Server version	9.1.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `avinor_xml_arrivals`
--

DROP TABLE IF EXISTS `avinor_xml_arrivals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `avinor_xml_arrivals` (
  `unique_id` varchar(12) NOT NULL,
  `airline` varchar(10) NOT NULL DEFAULT 'N/A',
  `flight_id` varchar(20) NOT NULL DEFAULT 'N/A',
  `dom_int` char(5) NOT NULL DEFAULT 'N/A',
  `schedule_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `arr_dep` char(5) NOT NULL DEFAULT 'N/A',
  `airport` varchar(10) NOT NULL DEFAULT 'N/A',
  `status_code` char(5) NOT NULL DEFAULT 'N/A',
  `status_time` datetime DEFAULT '1970-01-01 00:00:00',
  `belt` varchar(5) NOT NULL DEFAULT 'N/A',
  `check_in` varchar(50) NOT NULL DEFAULT 'N/A',
  `gate` varchar(10) NOT NULL DEFAULT 'N/A',
  `dlayed` char(5) NOT NULL DEFAULT 'N/A',
  `last_update` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `sta` time DEFAULT NULL,
  `eta` time DEFAULT NULL,
  `ata` time DEFAULT NULL,
  PRIMARY KEY (`unique_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `avinor_xml_departures`
--

DROP TABLE IF EXISTS `avinor_xml_departures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `avinor_xml_departures` (
  `unique_id` varchar(12) NOT NULL,
  `airline` varchar(10) NOT NULL DEFAULT 'N/A',
  `flight_id` varchar(20) NOT NULL DEFAULT 'N/A',
  `dom_int` char(5) NOT NULL DEFAULT 'N/A',
  `schedule_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `arr_dep` char(5) NOT NULL DEFAULT 'N/A',
  `airport` varchar(10) NOT NULL DEFAULT 'N/A',
  `status_code` char(5) NOT NULL DEFAULT 'N/A',
  `status_time` datetime DEFAULT '1970-01-01 00:00:00',
  `belt` varchar(5) NOT NULL DEFAULT 'N/A',
  `check_in` varchar(50) NOT NULL DEFAULT 'N/A',
  `gate` varchar(10) NOT NULL DEFAULT 'N/A',
  `dlayed` char(5) NOT NULL DEFAULT 'N/A',
  `last_update` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `std` time DEFAULT NULL,
  `etd` time DEFAULT NULL,
  `atd` time DEFAULT NULL,
  PRIMARY KEY (`unique_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `combined_flights`
--

DROP TABLE IF EXISTS `combined_flights`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `combined_flights` (
  `unique_id` varchar(12) NOT NULL,
  `airline` varchar(10) NOT NULL DEFAULT 'N/A',
  `flight_id` varchar(20) NOT NULL DEFAULT 'N/A',
  `ac_reg` varchar(20) NOT NULL DEFAULT 'N/A',
  `dom_int` char(5) NOT NULL DEFAULT 'N/A',
  `schedule_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `arr_dep` char(5) NOT NULL DEFAULT 'N/A',
  `airport` varchar(10) NOT NULL DEFAULT 'N/A',
  `status` varchar(10) DEFAULT NULL,
  `status_code` char(5) NOT NULL DEFAULT 'N/A',
  `status_time` datetime DEFAULT '1970-01-01 00:00:00',
  `belt` varchar(5) NOT NULL DEFAULT 'N/A',
  `check_in` varchar(50) NOT NULL DEFAULT 'N/A',
  `gate` varchar(10) NOT NULL DEFAULT 'N/A',
  `stand` varchar(10) DEFAULT NULL,
  `bag_transfer_status` varchar(50) DEFAULT NULL,
  `dlayed` char(5) NOT NULL DEFAULT 'N/A',
  `last_update` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `tidy_updated_at` datetime DEFAULT NULL,
  `sta` time DEFAULT NULL,
  PRIMARY KEY (`unique_id`),
  UNIQUE KEY `flight_id` (`flight_id`,`schedule_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_combined_flights_ai` AFTER INSERT ON `combined_flights` FOR EACH ROW BEGIN
    -- Verificar si el nuevo registro no contiene NULL en las columnas clave
    IF (NEW.status IS NOT NULL
        AND NEW.status_time IS NOT NULL
        AND NEW.stand IS NOT NULL
        AND NEW.bag_transfer_status IS NOT NULL
        AND NEW.tidy_updated_at IS NOT NULL
        AND NEW.sta IS NOT NULL
    ) THEN
        INSERT INTO fullyscraped_combined_flights (
          unique_id,
          airline,
          flight_id,
          ac_reg,
          dom_int,
          schedule_time,
          arr_dep,
          airport,
          status,
          status_code,
          status_time,
          belt,
          check_in,
          gate,
          stand,
          bag_transfer_status,
          dlayed,
          last_update,
          tidy_updated_at,
          sta
        )
        VALUES (
          NEW.unique_id,
          NEW.airline,
          NEW.flight_id,
          NEW.ac_reg,
          NEW.dom_int,
          NEW.schedule_time,
          NEW.arr_dep,
          NEW.airport,
          NEW.status,
          NEW.status_code,
          NEW.status_time,
          NEW.belt,
          NEW.check_in,
          NEW.gate,
          NEW.stand,
          NEW.bag_transfer_status,
          NEW.dlayed,
          NEW.last_update,
          NEW.tidy_updated_at,
          NEW.sta
        )
        ON DUPLICATE KEY UPDATE
          airline             = VALUES(airline),
          flight_id           = VALUES(flight_id),
          ac_reg              = VALUES(ac_reg),
          dom_int             = VALUES(dom_int),
          schedule_time       = VALUES(schedule_time),
          arr_dep             = VALUES(arr_dep),
          airport             = VALUES(airport),
          status              = VALUES(status),
          status_code         = VALUES(status_code),
          status_time         = VALUES(status_time),
          belt                = VALUES(belt),
          check_in            = VALUES(check_in),
          gate                = VALUES(gate),
          stand               = VALUES(stand),
          bag_transfer_status = VALUES(bag_transfer_status),
          dlayed              = VALUES(dlayed),
          last_update         = VALUES(last_update),
          tidy_updated_at     = VALUES(tidy_updated_at),
          sta                 = VALUES(sta);
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_combined_flights_au` AFTER UPDATE ON `combined_flights` FOR EACH ROW BEGIN
    -- Si el registro actualizado está completo (sin NULL en columnas susceptibles)
    IF (NEW.status IS NOT NULL
        AND NEW.status_time IS NOT NULL
        AND NEW.stand IS NOT NULL
        AND NEW.bag_transfer_status IS NOT NULL
        AND NEW.tidy_updated_at IS NOT NULL
        AND NEW.sta IS NOT NULL
    ) THEN
        INSERT INTO fullyscraped_combined_flights (
          unique_id,
          airline,
          flight_id,
          ac_reg,
          dom_int,
          schedule_time,
          arr_dep,
          airport,
          status,
          status_code,
          status_time,
          belt,
          check_in,
          gate,
          stand,
          bag_transfer_status,
          dlayed,
          last_update,
          tidy_updated_at,
          sta
        )
        VALUES (
          NEW.unique_id,
          NEW.airline,
          NEW.flight_id,
          NEW.ac_reg,
          NEW.dom_int,
          NEW.schedule_time,
          NEW.arr_dep,
          NEW.airport,
          NEW.status,
          NEW.status_code,
          NEW.status_time,
          NEW.belt,
          NEW.check_in,
          NEW.gate,
          NEW.stand,
          NEW.bag_transfer_status,
          NEW.dlayed,
          NEW.last_update,
          NEW.tidy_updated_at,
          NEW.sta
        )
        ON DUPLICATE KEY UPDATE
          airline             = VALUES(airline),
          flight_id           = VALUES(flight_id),
          ac_reg              = VALUES(ac_reg),
          dom_int             = VALUES(dom_int),
          schedule_time       = VALUES(schedule_time),
          arr_dep             = VALUES(arr_dep),
          airport             = VALUES(airport),
          status              = VALUES(status),
          status_code         = VALUES(status_code),
          status_time         = VALUES(status_time),
          belt                = VALUES(belt),
          check_in            = VALUES(check_in),
          gate                = VALUES(gate),
          stand               = VALUES(stand),
          bag_transfer_status = VALUES(bag_transfer_status),
          dlayed              = VALUES(dlayed),
          last_update         = VALUES(last_update),
          tidy_updated_at     = VALUES(tidy_updated_at),
          sta                 = VALUES(sta);
    END IF;

    -- Nota: si el vuelo pasó a tener columnas NULL, NO lo eliminamos ni modificamos
    -- en fullyscraped_combined_flights según tu petición.
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `dy_xml_arrivals`
--

DROP TABLE IF EXISTS `dy_xml_arrivals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dy_xml_arrivals` (
  `unique_id` varchar(12) NOT NULL,
  `airline` varchar(10) NOT NULL DEFAULT 'N/A',
  `flight_id` varchar(20) NOT NULL DEFAULT 'N/A',
  `dom_int` char(5) NOT NULL DEFAULT 'N/A',
  `schedule_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `arr_dep` char(5) NOT NULL DEFAULT 'N/A',
  `airport` varchar(10) NOT NULL DEFAULT 'N/A',
  `status_code` char(5) NOT NULL DEFAULT 'N/A',
  `status_time` datetime DEFAULT '1970-01-01 00:00:00',
  `belt` varchar(5) NOT NULL DEFAULT 'N/A',
  `check_in` varchar(50) NOT NULL DEFAULT 'N/A',
  `gate` varchar(10) NOT NULL DEFAULT 'N/A',
  `dlayed` char(5) NOT NULL DEFAULT 'N/A',
  `last_update` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `sta` time DEFAULT NULL,
  `eta` time DEFAULT NULL,
  `ata` time DEFAULT NULL,
  PRIMARY KEY (`unique_id`),
  UNIQUE KEY `unique_flight_schedule` (`flight_id`,`schedule_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_dyxml_arrivals_ai` AFTER INSERT ON `dy_xml_arrivals` FOR EACH ROW BEGIN
    INSERT INTO combined_flights (
       unique_id, airline, flight_id, dom_int, schedule_time, arr_dep,
       airport, status_code, status_time, belt, check_in, gate, dlayed,
       last_update, sta
    )
    VALUES (
       NEW.unique_id, NEW.airline, NEW.flight_id, NEW.dom_int, NEW.schedule_time,
       NEW.arr_dep, NEW.airport, NEW.status_code, NEW.status_time, NEW.belt,
       NEW.check_in, NEW.gate, NEW.dlayed, NEW.last_update, NEW.sta
    )
    ON DUPLICATE KEY UPDATE
       airline      = NEW.airline,
       dom_int      = NEW.dom_int,
       schedule_time = NEW.schedule_time,
       arr_dep      = NEW.arr_dep,
       airport      = NEW.airport,
       status_code  = NEW.status_code,
       status_time  = NEW.status_time,
       belt         = NEW.belt,
       check_in     = NEW.check_in,
       gate         = NEW.gate,
       dlayed       = NEW.dlayed,
       last_update  = NEW.last_update,
       sta          = NEW.sta;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_dyxml_arrivals_au` AFTER UPDATE ON `dy_xml_arrivals` FOR EACH ROW BEGIN
    INSERT INTO combined_flights (
       unique_id, airline, flight_id, dom_int, schedule_time, arr_dep,
       airport, status_code, status_time, belt, check_in, gate, dlayed,
       last_update, sta
    )
    VALUES (
       NEW.unique_id, NEW.airline, NEW.flight_id, NEW.dom_int, NEW.schedule_time,
       NEW.arr_dep, NEW.airport, NEW.status_code, NEW.status_time, NEW.belt,
       NEW.check_in, NEW.gate, NEW.dlayed, NEW.last_update, NEW.sta
    )
    ON DUPLICATE KEY UPDATE
       airline      = NEW.airline,
       dom_int      = NEW.dom_int,
       schedule_time = NEW.schedule_time,
       arr_dep      = NEW.arr_dep,
       airport      = NEW.airport,
       status_code  = NEW.status_code,
       status_time  = NEW.status_time,
       belt         = NEW.belt,
       check_in     = NEW.check_in,
       gate         = NEW.gate,
       dlayed       = NEW.dlayed,
       last_update  = NEW.last_update,
       sta          = NEW.sta;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `dy_xml_departures`
--

DROP TABLE IF EXISTS `dy_xml_departures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dy_xml_departures` (
  `unique_id` varchar(12) NOT NULL,
  `airline` varchar(10) NOT NULL DEFAULT 'N/A',
  `flight_id` varchar(20) NOT NULL DEFAULT 'N/A',
  `dom_int` char(5) NOT NULL DEFAULT 'N/A',
  `schedule_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `arr_dep` char(5) NOT NULL DEFAULT 'N/A',
  `airport` varchar(10) NOT NULL DEFAULT 'N/A',
  `status_code` char(5) NOT NULL DEFAULT 'N/A',
  `status_time` datetime DEFAULT '1970-01-01 00:00:00',
  `belt` varchar(5) NOT NULL DEFAULT 'N/A',
  `check_in` varchar(50) NOT NULL DEFAULT 'N/A',
  `gate` varchar(10) NOT NULL DEFAULT 'N/A',
  `dlayed` char(5) NOT NULL DEFAULT 'N/A',
  `last_update` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `std` time DEFAULT NULL,
  `etd` time DEFAULT NULL,
  `atd` time DEFAULT NULL,
  PRIMARY KEY (`unique_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fullyscraped_combined_flights`
--

DROP TABLE IF EXISTS `fullyscraped_combined_flights`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fullyscraped_combined_flights` (
  `unique_id` varchar(12) NOT NULL,
  `airline` varchar(10) NOT NULL DEFAULT 'N/A',
  `flight_id` varchar(20) NOT NULL DEFAULT 'N/A',
  `ac_reg` varchar(20) NOT NULL DEFAULT 'N/A',
  `dom_int` char(5) NOT NULL DEFAULT 'N/A',
  `schedule_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `arr_dep` char(5) NOT NULL DEFAULT 'N/A',
  `airport` varchar(10) NOT NULL DEFAULT 'N/A',
  `status` varchar(10) DEFAULT NULL,
  `status_code` char(5) NOT NULL DEFAULT 'N/A',
  `status_time` datetime DEFAULT '1970-01-01 00:00:00',
  `belt` varchar(5) NOT NULL DEFAULT 'N/A',
  `check_in` varchar(50) NOT NULL DEFAULT 'N/A',
  `gate` varchar(10) NOT NULL DEFAULT 'N/A',
  `stand` varchar(10) DEFAULT NULL,
  `bag_transfer_status` varchar(50) DEFAULT NULL,
  `dlayed` char(5) NOT NULL DEFAULT 'N/A',
  `last_update` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `tidy_updated_at` datetime DEFAULT NULL,
  `sta` time DEFAULT NULL,
  `ldm_obtained` tinyint DEFAULT '0',
  `transfer_bags_obtained` tinyint DEFAULT '0',
  PRIMARY KEY (`unique_id`),
  UNIQUE KEY `flight_id` (`flight_id`,`schedule_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `gate_history_arrivals`
--

DROP TABLE IF EXISTS `gate_history_arrivals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gate_history_arrivals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unique_id` varchar(12) NOT NULL,
  `gate` varchar(10) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `flight_id` varchar(20) DEFAULT NULL,
  `dom_int` char(1) DEFAULT NULL,
  `schedule_time` varchar(25) DEFAULT NULL,
  `airport` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_unique_id` (`unique_id`),
  CONSTRAINT `fk_unique_id` FOREIGN KEY (`unique_id`) REFERENCES `avinor_xml_arrivals` (`unique_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1610 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `gate_history_departures`
--

DROP TABLE IF EXISTS `gate_history_departures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gate_history_departures` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unique_id` varchar(12) NOT NULL,
  `gate` varchar(10) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `flight_id` varchar(20) DEFAULT NULL,
  `dom_int` char(1) DEFAULT NULL,
  `schedule_time` varchar(25) DEFAULT NULL,
  `airport` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_unique_id_departures` (`unique_id`),
  CONSTRAINT `fk_unique_id_departures` FOREIGN KEY (`unique_id`) REFERENCES `avinor_xml_departures` (`unique_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2020 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ldm_data`
--

DROP TABLE IF EXISTS `ldm_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ldm_data` (
  `unique_id` varchar(12) NOT NULL,
  `flight_id` varchar(20) NOT NULL DEFAULT 'N/A',
  `ac_reg` varchar(20) NOT NULL DEFAULT 'N/A',
  `schedule_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  `status` varchar(10) DEFAULT NULL,
  `status_code` char(5) NOT NULL DEFAULT 'N/A',
  `status_time` datetime DEFAULT '1970-01-01 00:00:00',
  `ldm_text` text NOT NULL,
  `ldm_obtained_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`unique_id`),
  CONSTRAINT `ldm_data_ibfk_1` FOREIGN KEY (`unique_id`) REFERENCES `fullyscraped_combined_flights` (`unique_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tidy_flight_arrivals`
--

DROP TABLE IF EXISTS `tidy_flight_arrivals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tidy_flight_arrivals` (
  `flight` varchar(20) NOT NULL,
  `date` datetime DEFAULT NULL,
  `from_origin` varchar(10) DEFAULT NULL,
  `ac_reg` varchar(20) NOT NULL,
  `status` varchar(10) DEFAULT NULL,
  `sta` datetime NOT NULL,
  `eta` datetime DEFAULT NULL,
  `ata` datetime DEFAULT NULL,
  `stand` varchar(10) DEFAULT NULL,
  `bag_transfer_status` varchar(50) DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`flight`,`ac_reg`,`sta`),
  KEY `fk_tidy_to_dyxml` (`flight`,`sta`),
  CONSTRAINT `fk_tidy_to_dyxml` FOREIGN KEY (`flight`, `sta`) REFERENCES `dy_xml_arrivals` (`flight_id`, `schedule_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_tidy_arrivals_ai` AFTER INSERT ON `tidy_flight_arrivals` FOR EACH ROW BEGIN
    -- Obtenemos el unique_id desde dy_xml_arrivals (flight_id = NEW.flight, schedule_time = NEW.sta)
    INSERT INTO combined_flights (
       unique_id, flight_id, schedule_time,
       ac_reg, status, stand, bag_transfer_status, tidy_updated_at
    )
    SELECT
       d.unique_id,         -- Recuperado de la tabla base
       d.flight_id,         
       d.schedule_time,     
       NEW.ac_reg,          
       NEW.status,          
       NEW.stand,           
       NEW.bag_transfer_status,
       NEW.updated_at
    FROM dy_xml_arrivals d
    WHERE d.flight_id = NEW.flight
      AND d.schedule_time = NEW.sta
    ON DUPLICATE KEY UPDATE
       ac_reg              = NEW.ac_reg,
       status              = NEW.status,
       stand               = NEW.stand,
       bag_transfer_status = NEW.bag_transfer_status,
       tidy_updated_at     = NEW.updated_at;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_tidy_arrivals_au` AFTER UPDATE ON `tidy_flight_arrivals` FOR EACH ROW BEGIN
    -- Obtenemos el unique_id desde dy_xml_arrivals (flight_id = NEW.flight, schedule_time = NEW.sta)
    INSERT INTO combined_flights (
       unique_id, flight_id, schedule_time,
       ac_reg, status, stand, bag_transfer_status, tidy_updated_at
    )
    SELECT
       d.unique_id,         -- Recuperado de la tabla base
       d.flight_id,
       d.schedule_time,
       NEW.ac_reg,
       NEW.status,
       NEW.stand,
       NEW.bag_transfer_status,
       NEW.updated_at
    FROM dy_xml_arrivals d
    WHERE d.flight_id = NEW.flight
      AND d.schedule_time = NEW.sta
    ON DUPLICATE KEY UPDATE
       ac_reg              = NEW.ac_reg,
       status              = NEW.status,
       stand               = NEW.stand,
       bag_transfer_status = NEW.bag_transfer_status,
       tidy_updated_at     = NEW.updated_at;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `tidy_transfer_info`
--

DROP TABLE IF EXISTS `tidy_transfer_info`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tidy_transfer_info` (
  `id` int NOT NULL AUTO_INCREMENT,
  `outbound_flight` varchar(20) NOT NULL DEFAULT 'N/A',
  `to` varchar(10) NOT NULL DEFAULT 'N/A',
  `ac_reg` varchar(20) NOT NULL DEFAULT 'N/A',
  `status` varchar(10) NOT NULL DEFAULT 'N/A',
  `total_bags` int NOT NULL DEFAULT '0',
  `std_etd` time NOT NULL DEFAULT '00:00:00',
  `estimated_connection_time` varchar(10) NOT NULL DEFAULT 'N/A',
  `gate` varchar(10) NOT NULL DEFAULT 'N/A',
  `stand` varchar(10) NOT NULL DEFAULT 'N/A',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping events for database 'flights'
--

--
-- Dumping routines for database 'flights'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-01-17 13:02:02
