<?php
	require_once("config.php");
	require_once("tool.php");
	$winner=$_REQUEST['winner'];
	$loser=$_REQUEST['loser'];
	if(!chkuuid($winner) || !chkuuid($loser)){
		echo json_encode(array("error_code"=>98));
		return;
	}
	$db=mysqli_connect('localhost',$db_user,$db_passwd);
	if(!$db){
		echo json_encode(array("error_code"=>99));
		return;
	}
	mysqli_select_db( $db,$db_name);
	$sql='select * from user where uuid='."'$winner'";
	$ret=mysqli_query($db,$sql);
	if($ret->num_rows == 0){
		echo json_encode(array("error_code"=>1));
		return;
	}
	$row = mysqli_fetch_array($ret);
	$rating_winner=$row['rating'];
	$sql='select * from user where uuid='."'$loser'";
	$ret=mysqli_query($db,$sql);
	if($ret->num_rows == 0){
		echo json_encode(array("error_code"=>1));
		return;
	}
	$row = mysqli_fetch_array($ret);
	$rating_loser=$row['rating'];
	$EA=1/(1+pow(10,($rating_loser-$rating_winner)/400));
	$EB=1/(1+pow(10,($rating_winner-$rating_loser)/400));
	$RA=$rating_winner+32*(1-$EA);
	$RB=$rating_loser+32*(-$EB);
	$sql='update user set rating='.$RA.' where uuid='."'$winner'";
	$ret=mysqli_query($db,$sql);
	$sql='update user set rating='.$RB.' where uuid='."'$loser'";
	$ret=mysqli_query($db,$sql);
	echo json_encode(array("error_code"=>0));
	return;
?>
